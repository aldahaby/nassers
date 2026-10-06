import SwiftUI
import WidgetKit

struct NextSessionEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot?
}

struct NextSessionProvider: TimelineProvider {
  func placeholder(in context: Context) -> NextSessionEntry { NextSessionEntry(date: Date(), snapshot: .placeholder) }

  func getSnapshot(in context: Context, completion: @escaping (NextSessionEntry) -> Void) {
    completion(NextSessionEntry(date: Date(), snapshot: WidgetSnapshot.load() ?? .placeholder))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NextSessionEntry>) -> Void) {
    let snap = WidgetSnapshot.load()
    // Refresh at the next plan's start (so "Ready now" appears), else in an hour. The app also
    // reloads timelines whenever the plan changes, so this stays infrequent.
    let next = snap?.plannedStartDate.flatMap { $0 > Date() ? $0 : nil } ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [NextSessionEntry(date: Date(), snapshot: snap)], policy: .after(next)))
  }
}

/// SMALL: Studyling · next course · next time · Start.  MEDIUM: + assignment, duration, today, Start & Lock.
struct StudylingNextSessionWidget: Widget {
  let kind = "StudylingNextSession"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: NextSessionProvider()) { entry in
      NextSessionView(entry: entry)
    }
    .configurationDisplayName("Next study block")
    .description("Your next planned study block. Tap to start it.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct NextSessionView: View {
  @Environment(\.widgetFamily) var family
  let entry: NextSessionEntry

  var body: some View {
    let s = entry.snapshot
    Group {
      if family == .systemMedium { medium(s) } else { small(s) }
    }
    .widgetURL(s?.startURL)
    .studylingBackground()
  }

  private func timeText(_ s: WidgetSnapshot?) -> Text {
    if let a = s?.activeSession { return Text("Until ") + Text(Date(timeIntervalSince1970: a.endsAt / 1000), style: .time) }
    if let d = s?.plannedStartDate { return Text(d, style: .time) }
    return Text("Nothing planned")
  }

  private func small(_ s: WidgetSnapshot?) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Studyling").font(.caption2.weight(.heavy)).foregroundStyle(Color.studyling)
      Text(s?.courseDisplayName ?? (s?.nextPlanId != nil ? "Study block" : "No block yet"))
        .font(.headline).lineLimit(2)
      timeText(s).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
      Spacer(minLength: 0)
      Text(s?.activeSession != nil ? "Studying" : "Start")
        .font(.caption.weight(.heavy)).foregroundStyle(.white)
        .padding(.horizontal, 10).padding(.vertical, 4)
        .background(Capsule().fill(Color.studyling))
    }
    .accessibilityElement(children: .combine)
  }

  private func medium(_ s: WidgetSnapshot?) -> some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 3) {
        Text("Studyling").font(.caption2.weight(.heavy)).foregroundStyle(Color.studyling)
        if let c = s?.courseDisplayName { Text(c).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
        Text(s?.assignmentDisplayTitle ?? (s?.nextPlanId != nil ? "Study session" : "Nothing planned"))
          .font(.headline).lineLimit(2)
        if let m = s?.plannedMinutes, s?.nextPlanId != nil {
          (Text("\(m) min · ") + timeText(s)).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
        }
        Text("Today: \(s?.todayPlanCount ?? 0) block\((s?.todayPlanCount ?? 0) == 1 ? "" : "s")")
          .font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      VStack {
        Spacer(minLength: 0)
        if let url = s?.startURL {
          Link(destination: url) {
            Text("Start & Lock").font(.caption.weight(.heavy)).foregroundStyle(.white)
              .padding(.horizontal, 12).padding(.vertical, 6)
              .background(Capsule().fill(Color.studyling))
          }
        }
      }
    }
    .accessibilityElement(children: .combine)
  }
}

extension View {
  /// iOS 17 container background, plain background before that.
  @ViewBuilder func studylingBackground() -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { Color.studylingBackground }
    } else {
      padding().background(Color.studylingBackground)
    }
  }
}
