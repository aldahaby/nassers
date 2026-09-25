import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Focusling's shield. Neutral, friendly copy; no guilt.
/// - Whole-app session: "Nimbus is focusing with you."
/// - Reels intervention: "Reels are blocked during this focus session."
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private let purple = UIColor(red: 0x7B / 255, green: 0x5C / 255, blue: 0xFF / 255, alpha: 1)
  private let cream = UIColor(red: 0xFF / 255, green: 0xF6 / 255, blue: 0xEC / 255, alpha: 1)
  private let ink = UIColor(red: 0x2F / 255, green: 0x25 / 255, blue: 0x48 / 255, alpha: 1)

  override func configuration(shielding application: Application) -> ShieldConfiguration { make() }
  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { make() }
  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { make() }
  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { make() }

  private func make() -> ShieldConfiguration {
    let intervention = FocuslingShared.interventionActive
    let title = intervention ? "Reels are blocked during this focus session." : "\(FocuslingShared.petName) is focusing with you."
    let subtitle = intervention
      ? "The rest of the app will be available when you come back. Your session keeps going."
      : "This app is resting until your focus session ends."
    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterialLight,
      backgroundColor: cream,
      icon: UIImage(systemName: "leaf.fill"),
      title: ShieldConfiguration.Label(text: title, color: ink),
      subtitle: ShieldConfiguration.Label(text: subtitle, color: ink.withAlphaComponent(0.7)),
      primaryButtonLabel: ShieldConfiguration.Label(text: "Back to focus", color: .white),
      primaryButtonBackgroundColor: purple,
      secondaryButtonLabel: nil
    )
  }
}
