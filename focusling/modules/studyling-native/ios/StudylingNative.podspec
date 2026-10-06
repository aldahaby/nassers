Pod::Spec.new do |s|
  s.name           = 'StudylingNative'
  s.version        = '0.1.0'
  s.summary        = 'Studyling planner: on-device syllabus text (PDFKit + Vision), widget snapshot, study Live Activity.'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'Studyling'
  s.homepage       = 'https://example.invalid/studyling'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit', 'Vision', 'WidgetKit', 'ActivityKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
