import SwiftUI
import WidgetKit

@main
struct StudylingWidgetBundle: WidgetBundle {
  var body: some Widget {
    StudylingNextSessionWidget()
    StudylingLiveActivity()
  }
}
