Pod::Spec.new do |s|
  s.name           = 'FocuslingProtection'
  s.version        = '0.1.0'
  s.summary        = 'Focusling focus protection: Screen Time shields, DeviceActivity, on-device Reels recognition.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Focusling'
  s.homepage       = 'https://example.invalid/focusling'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'Vision', 'CoreImage'
  # ScreenCaptureKit on iOS exists from iOS 27; weak-link so older iOS still launches (feature reports "unavailable").
  s.weak_frameworks = 'ScreenCaptureKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
  s.exclude_files = 'DetectionCore/Package.swift', 'DetectionCore/Tests/**/*'
end
