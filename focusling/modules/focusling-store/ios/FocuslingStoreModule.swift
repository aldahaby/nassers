import ExpoModulesCore
import StoreKit
import UIKit

/// Focusling Premium over StoreKit 2 (iOS 15+ APIs; the app targets 16.4).
///
/// Responsibilities, all small and explicit:
/// - fetch products (`Product.products(for:)`) with StoreKit-localized prices;
/// - purchase (`Product.purchase()`) and report success / pending (Ask to Buy) /
///   cancelled / failed;
/// - compute the current entitlement from VERIFIED `Transaction.currentEntitlements`
///   (refunded/revoked transactions don't appear there; expired ones are checked);
/// - listen to `Transaction.updates` from launch (renewals, refunds, offer codes,
///   Ask to Buy approvals, other devices) and emit `onEntitlementChange`;
/// - finish every verified transaction after its entitlement is recorded;
/// - restore with `AppStore.sync()`;
/// - present `AppStore.showManageSubscriptions(in:)`.
///
/// No Premium state is stored on the JS side or in the game save: JS asks this
/// module, which asks StoreKit. UNTESTED until run on a device or simulator with
/// App Store Connect products or a StoreKit configuration file.
public final class FocuslingStoreModule: Module {
  private var updatesTask: Task<Void, Never>?
  private var watchedProductIds: Set<String> = []

  public func definition() -> ModuleDefinition {
    Name("FocuslingStore")

    Events("onEntitlementChange")

    OnCreate {
      self.startListeningForTransactions()
    }

    OnDestroy {
      self.updatesTask?.cancel()
    }

    AsyncFunction("canMakePayments") { () -> Bool in
      AppStore.canMakePayments
    }

    AsyncFunction("getProducts") { (ids: [String]) async throws -> [[String: Any]] in
      let products = try await Product.products(for: ids)
      var result: [[String: Any]] = []
      for product in products {
        var item: [String: Any] = [
          "id": product.id,
          "title": product.displayName,
          "displayPrice": product.displayPrice,
          "period": Self.periodName(product.subscription?.subscriptionPeriod),
        ]
        if let subscription = product.subscription {
          item["introOfferEligible"] = await subscription.isEligibleForIntroOffer
          if let intro = subscription.introductoryOffer {
            item["introOfferText"] = Self.describe(intro)
          }
        }
        result.append(item)
      }
      return result
    }

    AsyncFunction("purchase") { (productId: String) async throws -> [String: Any] in
      guard let product = try await Product.products(for: [productId]).first else {
        return ["status": "failed", "message": "That subscription isn't available right now."]
      }
      self.watchedProductIds.insert(productId)
      let result = try await product.purchase()
      switch result {
      case .success(let verification):
        guard case .verified(let transaction) = verification else {
          // Unverified transactions never unlock anything.
          return ["status": "failed", "message": "The App Store couldn't verify this purchase."]
        }
        await transaction.finish()
        return ["status": "success", "entitlement": await self.entitlement(for: [productId])]
      case .pending:
        // e.g. Ask to Buy: the approval arrives later through Transaction.updates.
        return ["status": "pending"]
      case .userCancelled:
        return ["status": "cancelled"]
      @unknown default:
        return ["status": "failed", "message": "Unknown purchase result."]
      }
    }

    AsyncFunction("currentEntitlement") { (productIds: [String]) async -> [String: Any] in
      self.watchedProductIds.formUnion(productIds)
      return await self.entitlement(for: Set(productIds))
    }

    AsyncFunction("sync") { (productIds: [String]) async throws -> [String: Any] in
      self.watchedProductIds.formUnion(productIds)
      // Restore Purchases: forces a resync with the App Store (may ask the person to sign in).
      try await AppStore.sync()
      return await self.entitlement(for: Set(productIds))
    }

    AsyncFunction("showManageSubscriptions") { () async -> Bool in
      guard let scene = await MainActor.run(body: {
        UIApplication.shared.connectedScenes.first { $0.activationState == .foregroundActive } as? UIWindowScene
      }) else { return false }
      do {
        try await AppStore.showManageSubscriptions(in: scene)
        return true
      } catch {
        return false
      }
    }
  }

  /// Start the updates listener as early as possible (StoreKit delivers unfinished
  /// transactions once at launch through this sequence).
  private func startListeningForTransactions() {
    updatesTask?.cancel()
    updatesTask = Task.detached { [weak self] in
      for await verification in Transaction.updates {
        guard let self else { return }
        if case .verified(let transaction) = verification {
          await transaction.finish()
        }
        let ids = self.watchedProductIds.isEmpty ? Set<String>() : self.watchedProductIds
        let entitlement = await self.entitlement(for: ids)
        self.sendEvent("onEntitlementChange", entitlement)
      }
    }
  }

  /// The active Premium entitlement among `productIds` (any product if empty),
  /// from verified current entitlements only.
  private func entitlement(for productIds: Set<String>) async -> [String: Any] {
    var latest: Transaction?
    for await verification in Transaction.currentEntitlements {
      guard case .verified(let transaction) = verification else { continue }
      guard productIds.isEmpty || productIds.contains(transaction.productID) else { continue }
      guard transaction.revocationDate == nil else { continue }
      if let expires = transaction.expirationDate, expires < Date() { continue }
      if latest == nil || (transaction.expirationDate ?? .distantFuture) > (latest?.expirationDate ?? .distantPast) {
        latest = transaction
      }
    }
    guard let transaction = latest else {
      return ["active": false]
    }
    var result: [String: Any] = ["active": true, "productId": transaction.productID]
    if let expires = transaction.expirationDate {
      result["expiresAtMs"] = expires.timeIntervalSince1970 * 1000
    }
    // Renewal intent, when StoreKit can tell us.
    if let product = try? await Product.products(for: [transaction.productID]).first,
       let statuses = try? await product.subscription?.status,
       let status = statuses.first(where: { status in
         if case .verified(let t) = status.transaction { return t.productID == transaction.productID }
         return false
       }),
       case .verified(let renewal) = status.renewalInfo {
      result["willAutoRenew"] = renewal.willAutoRenew
    }
    return result
  }

  private static func periodName(_ period: Product.SubscriptionPeriod?) -> String {
    guard let period else { return "unknown" }
    switch period.unit {
    case .day: return period.value == 7 ? "week" : "unknown"
    case .week: return "week"
    case .month: return "month"
    case .year: return "year"
    @unknown default: return "unknown"
    }
  }

  private static func describe(_ offer: Product.SubscriptionOffer) -> String {
    let unit: String
    switch offer.period.unit {
    case .day: unit = "day"
    case .week: unit = "week"
    case .month: unit = "month"
    case .year: unit = "year"
    @unknown default: unit = "period"
    }
    let count = offer.period.value * max(1, offer.periodCount)
    let span = "\(count) \(unit)\(count == 1 ? "" : "s")"
    switch offer.paymentMode {
    case .freeTrial: return "\(span) free"
    default: return "\(offer.displayPrice) for \(span)"
    }
  }
}
