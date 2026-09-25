import CoreMedia
import Foundation
import ScreenCaptureKit
import UIKit

/// Full-display screen capture using the iOS 27 ScreenCaptureKit flow:
/// system content-sharing picker → SCContentFilter → SCStream.
///
/// - Capture starts only after the person confirms the system picker.
/// - Video only: no audio, no microphone.
/// - Frames are delivered at a small output size and sampled at a low rate by the
///   coordinator; unsampled frames are dropped immediately. Nothing is recorded.
/// - The system recording indicator is shown by iOS and is never hidden.
/// - Requires `UIBackgroundModes: screen-capture` to keep running while another
///   app (Instagram) is in front.
@available(iOS 27.0, *)
final class ScreenCaptureController: NSObject, SCContentSharingPickerObserver, SCStreamDelegate, SCStreamOutput {
  enum StopReason: String { case userStopped = "user-stopped", system, error }

  var onFrame: ((CVPixelBuffer) -> Void)?
  var onStop: ((StopReason, Error?) -> Void)?

  private let picker = SCContentSharingPicker.shared
  private var stream: SCStream?
  private var pendingStart: CheckedContinuation<Void, Error>?
  private let frameQueue = DispatchQueue(label: "focusling.capture.frames", qos: .utility)
  private var maxDimension: CGFloat = 640

  static var isAvailable: Bool { SCContentSharingPicker.shared.isAvailable }
  var isRunning: Bool { stream != nil }

  /// Presents the system picker and resolves once the stream has started.
  @MainActor
  func start(maxDimension: CGFloat) async throws {
    self.maxDimension = maxDimension
    await stop()
    picker.add(self)
    var config = SCContentSharingPickerConfiguration()
    config.showsMicrophoneControl = false
    config.showsCameraControl = false
    picker.defaultConfiguration = config
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      pendingStart = continuation
      picker.present()
    }
  }

  @MainActor
  func stop() async {
    guard let current = stream else { return }
    stream = nil
    await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
      current.stopCapture { _ in continuation.resume() }
    }
    picker.remove(self)
  }

  // MARK: SCContentSharingPickerObserver

  func contentSharingPicker(_ picker: SCContentSharingPicker, didUpdateWith filter: SCContentFilter, for stream: SCStream?) {
    Task { @MainActor in await self.startStream(filter: filter) }
  }

  func contentSharingPicker(_ picker: SCContentSharingPicker, didCancelFor stream: SCStream?) {
    Task { @MainActor in self.finishPendingStart(with: CaptureError.cancelled) }
  }

  func contentSharingPickerStartDidFailWithError(_ error: Error) {
    Task { @MainActor in self.finishPendingStart(with: error) }
  }

  @MainActor
  private func startStream(filter: SCContentFilter) async {
    let config = SCStreamConfiguration()
    let bounds = UIScreen.main.bounds.size
    let scale = min(1, maxDimension / max(bounds.width, bounds.height))
    config.width = Int(bounds.width * scale)
    config.height = Int(bounds.height * scale)
    config.capturesAudio = false

    let newStream = SCStream(filter: filter, configuration: config, delegate: self)
    do {
      try newStream.addStreamOutput(self, type: .screen, sampleHandlerQueue: frameQueue)
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        newStream.startCapture { error in
          if let error { continuation.resume(throwing: error) } else { continuation.resume() }
        }
      }
      stream = newStream
      finishPendingStart(with: nil)
    } catch {
      finishPendingStart(with: error)
    }
  }

  @MainActor
  private func finishPendingStart(with error: Error?) {
    guard let continuation = pendingStart else { return }
    pendingStart = nil
    if let error { continuation.resume(throwing: error) } else { continuation.resume() }
  }

  // MARK: SCStreamOutput

  func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen, sampleBuffer.isValid, let pixelBuffer = sampleBuffer.imageBuffer else { return }
    onFrame?(pixelBuffer)
  }

  // MARK: SCStreamDelegate

  func stream(_ stream: SCStream, didStopWithError error: Error) {
    let reason: StopReason = (error as NSError).code == SCStreamError.Code.userStopped.rawValue ? .userStopped : .error
    Task { @MainActor in
      if self.stream === stream { self.stream = nil }
      self.onStop?(reason, error)
    }
  }

  enum CaptureError: LocalizedError {
    case cancelled
    var errorDescription: String? { "Screen recognition wasn't started." }
  }
}
