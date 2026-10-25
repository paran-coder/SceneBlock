param([string]$OutputFile="")
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
$root=Split-Path $PSScriptRoot -Parent
$source=Join-Path $root 'ai-connector'
$tempDir=Join-Path $root ('2026-10-25-runtime\installer-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir|Out-Null
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$dialogs=Join-Path $source '2026-10-25-dialogs.cs'
$approval=Join-Path $tempDir '2026-10-25-SceneBlock-Approval.exe'
& $compiler '/nologo' '/codepage:65001' '/target:winexe' '/platform:x64' '/main:SceneBlockApproval' ('/out:'+$approval) '/r:System.Windows.Forms.dll' '/r:System.Drawing.dll' $dialogs
if($LASTEXITCODE){throw 'Approval dialog compile failed'}
$payload=Join-Path $tempDir 'payload.zip' 
$stream=[IO.File]::Open($payload,[IO.FileMode]::CreateNew)
$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create)
try{
 $names=@('2026-10-23-connector.mjs','2026-10-23-sessions.mjs','2026-10-23-providers.mjs','2026-10-23-schema.mjs','2026-10-25-intent-schema.mjs','2026-10-25-intent.schema.json','2026-10-23-scene-plan.schema.json','2026-10-23-on-demand.mjs','2026-10-23-start.ps1','2026-10-23-protocol.vbs','2026-10-23-Node-LICENSE.txt')
 $files=@{};foreach($name in $names){$files[$name]=Join-Path $source $name};$files['2026-10-25-SceneBlock-Approval.exe']=$approval;$files['node.exe']=(Get-Command node.exe -ErrorAction Stop).Source
 foreach($name in $files.Keys){$entry=$zip.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$input=[IO.File]::OpenRead($files[$name]);$output=$entry.Open();try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}}
}finally{$zip.Dispose();$stream.Dispose()}
$legacy=Join-Path $tempDir 'legacy-hashes.txt'
$fingerprints=New-Object 'System.Collections.Generic.List[string]'
foreach($version in @('2.6.0','2.7.0','2.8.0','2.9.0','2.10.0','2.10.1')){
 $old=Get-ChildItem -LiteralPath (Join-Path $root 'public\downloads') -Filter ('*Setup-v'+$version+'.exe')
 if(@($old).Count -ne 1){throw ('Missing trusted installer '+$version)}
 $assembly=[Reflection.Assembly]::LoadFile($old.FullName)
 $oldStream=$assembly.GetManifestResourceStream('payload.zip')
 $oldZip=New-Object IO.Compression.ZipArchive($oldStream,[IO.Compression.ZipArchiveMode]::Read)
 try{foreach($entry in $oldZip.Entries){
  if($entry.FullName -ne [IO.Path]::GetFileName($entry.FullName)){throw 'Unsafe legacy payload path'}
  $input=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create()
  try{$hash=([BitConverter]::ToString($sha.ComputeHash($input))).Replace('-','').ToLowerInvariant();$fingerprints.Add($version+"`t"+$entry.FullName+"`t"+$hash)}finally{$input.Dispose();$sha.Dispose()}
 }}finally{$oldZip.Dispose();$oldStream.Dispose()}
}
[IO.File]::WriteAllLines($legacy,$fingerprints,(New-Object Text.UTF8Encoding($false)))
$exe=if($OutputFile){[IO.Path]::GetFullPath($OutputFile)}else{Join-Path $root 'public\downloads\2026-10-25-SceneBlock-AI-Setup-v2.10.2.exe'}
if(Test-Path -LiteralPath $exe){throw 'Installer exists; refusing overwrite.'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler '/nologo' '/codepage:65001' '/target:winexe' '/main:SceneBlockSetup' '/platform:x64' ('/out:'+$exe) ('/resource:'+$payload+',payload.zip') ('/resource:'+$legacy+',legacy-hashes.txt') '/r:System.Windows.Forms.dll' '/r:System.Drawing.dll' '/r:System.Core.dll' '/r:System.IO.Compression.dll' (Join-Path $source '2026-10-23-installer.cs') (Join-Path $source '2026-10-25-installation-manager.cs') (Join-Path $source '2026-10-25-process-usage.cs') $dialogs
if($LASTEXITCODE){throw 'Compile failed'}
$process=Start-Process -FilePath $exe -ArgumentList '--verify-payload' -Wait -PassThru -WindowStyle Hidden
if($process.ExitCode){throw 'Payload validation failed'}
Write-Output ('Compiled and verified payload without installation: '+$exe)
