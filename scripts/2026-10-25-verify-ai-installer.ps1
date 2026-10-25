$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$installer=Join-Path $root 'public\downloads\2026-10-25-SceneBlock-AI-Setup-v2.8.0.exe'
$base=Join-Path $root 'dev\2026-10-25-ai-installer-check'
New-Item -ItemType Directory -Force -Path $base|Out-Null
$output=Join-Path $base ([Guid]::NewGuid().ToString('N'))
function RunCheck([string]$file,[string]$arguments){$p=Start-Process -FilePath $file -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden;if($p.ExitCode -ne 0){throw ('Self-test failed: '+$p.ExitCode)}}
RunCheck $installer '--verify-payload'
RunCheck $installer ('--test-upgrade "'+$output+'"')
RunCheck (Join-Path $output '2.8.0\2026-10-25-SceneBlock-Approval.exe') ('--self-test "'+(Join-Path $output '2026-10-25-dialog-check')+'"')
RunCheck $installer ('--preview "'+(Join-Path $output '2026-10-25-installer.png')+'"')
$result=@{payloadVerified=$true;upgradePreservationVerified=$true;dialogActionsVerified=$true;actualInstallationModified=$false;providerInvoked=$false;outputDirectory=$output}
$result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $output '2026-10-25-native-verification.json') -Encoding UTF8
$result|ConvertTo-Json -Compress
