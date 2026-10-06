import ActivityKit
import SwiftUI
import WidgetKit

/// Study-session Live Activity: Studyling, course/assignment if privacy allows, time left,
/// protection status. No coins, shop or missions. Text never claims "Protected" unless the
/// app reported native protection as on.
struct StudylingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StudylingActivityAttributes.self) { context in
      LockScreenView(state: context.state)
        .activityBackgroundTint(Color.studylingBackground)
        .widgetURL(URL(string: "focusling://planner?source=liveActivity"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.state.title).font(.caption.weight(.heavy))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timerInterval: Date()...max(Date(), context.state.endsAt), countsDown: true).monospacedDigit().font(.headline)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading) {
            Text(context.state.subtitle).font(.subheadline.weight(.semibold)).lineLimit(1)
            Text(protectionLabel(context.state.protection)).font(.caption).foregroundStyle(.secondary)
          }
        }
      } compactLeading: {
        Image(systemName: "book.closed")
      } compactTrailing: {
        Text(timerInterval: Date()...max(Date(), context.state.endsAt), countsDown: true).monospacedDigit().frame(width: 44)
      } minimal: {
        Image(systemName: "book.closed")
      }
    }
  }
}

private struct LockScreenView: View {
  let state: StudylingActivityAttributes.ContentState
  var body: some View {
    HStack {
      VStack(alignment: .leading, spacing: 2) {
        Text(state.title).font(.caption.weight(.heavy))
        Text(state.subtitle).font(.headline).lineLimit(1)
        Text(protectionLabel(state.protection)).font(.caption).foregroundStyle(.secondary)
      }
      Spacer()
      Text(timerInterval: Date()...max(Date(), state.endsAt), countsDown: true).monospacedDigit().font(.title2.weight(.bold)).multilineTextAlignment(.trailing)
    }
    .padding()
    .accessibilityElement(children: .combine)
  }
}

private func protectionLabel(_ p: String) -> String {
  switch p {
  case "on": return "Protected"
  case "simulated": return "Protection simulated"
  default: return "Not protected"
  }
}
