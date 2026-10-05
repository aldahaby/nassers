Pod::Spec.new do |s|
  s.name           = 'FocuslingStore'
  s.version        = '0.1.0'
  s.summary        = 'Focusling Premium: StoreKit 2 subscriptions behind a small Expo module.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Focusling'
  s.homepage       = 'https://example.invalid/focusling'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'StoreKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
