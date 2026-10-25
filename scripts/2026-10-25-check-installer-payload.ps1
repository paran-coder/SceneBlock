$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
$root=Split-Path $PSScriptRoot -Parent
$exe=Join-Path $root 'public\downloads\2026-10-25-SceneBlock-AI-Setup-v2.10.3.exe'
function HashStream($stream){$sha=[Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
$assembly=[Reflection.Assembly]::LoadFile($exe)
$stream=$assembly.GetManifestResourceStream('payload.zip')
$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Read)
$checked=0
try{foreach($entry in $zip.Entries){
 if($entry.FullName -eq '2026-10-25-SceneBlock-Approval.exe'){continue}
 $source=if($entry.FullName -eq 'node.exe'){(Get-Command node.exe).Source}else{Join-Path $root ('ai-connector\'+$entry.FullName)}
 $input=$entry.Open();$file=[IO.File]::OpenRead($source)
 try{if((HashStream $input) -ne (HashStream $file)){throw ('Payload mismatch '+$entry.FullName)};$checked++}finally{$input.Dispose();$file.Dispose()}
}}finally{$zip.Dispose();$stream.Dispose()}
$legacy=$assembly.GetManifestResourceStream('legacy-hashes.txt');$reader=New-Object IO.StreamReader($legacy)
try{$lines=$reader.ReadToEnd().Trim().Split([char]10)}finally{$reader.Dispose()}
if($checked -ne 12 -or $lines.Count -lt 30){throw 'Incomplete payload/signatures'}
$report=@{sourcePayloadEntries=$checked;trustedLegacySignatures=$lines.Count;installerSHA256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash;actualInstallationModified=$false}
$report|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'dev\2026-10-25-installation-management-verification\2026-10-25-payload-parity.json') -Encoding UTF8
$report|ConvertTo-Json -Compress
