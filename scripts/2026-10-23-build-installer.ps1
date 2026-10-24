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
 $names=@('2026-10-23-connector.mjs','2026-10-23-sessions.mjs','2026-10-23-providers.mjs','2026-10-23-schema.mjs','2026-10-23-scene-plan.schema.json','2026-10-23-on-demand.mjs','2026-10-23-start.ps1','2026-10-23-protocol.vbs','2026-10-23-Node-LICENSE.txt')
 $files=@{};foreach($name in $names){$files[$name]=Join-Path $source $name};$files['2026-10-25-SceneBlock-Approval.exe']=$approval;$files['node.exe']=(Get-Command node.exe -ErrorAction Stop).Source
 foreach($name in $files.Keys){$entry=$zip.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$input=[IO.File]::OpenRead($files[$name]);$output=$entry.Open();try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}}
}finally{$zip.Dispose();$stream.Dispose()}
$exe=if($OutputFile){[IO.Path]::GetFullPath($OutputFile)}else{Join-Path $root 'public\downloads\2026-10-25-SceneBlock-AI-Setup-v2.7.0.exe'}
if(Test-Path -LiteralPath $exe){throw 'Installer exists; refusing overwrite.'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler '/nologo' '/codepage:65001' '/target:winexe' '/main:SceneBlockSetup' '/platform:x64' ('/out:'+$exe) ('/resource:'+$payload+',payload.zip') '/r:System.Windows.Forms.dll' '/r:System.Drawing.dll' '/r:System.IO.Compression.dll' (Join-Path $source '2026-10-23-installer.cs') $dialogs
if($LASTEXITCODE){throw 'Compile failed'}
$process=Start-Process -FilePath $exe -ArgumentList '--verify-payload' -Wait -PassThru -WindowStyle Hidden
if($process.ExitCode){throw 'Payload validation failed'}
Write-Output ('Compiled and verified payload without installation: '+$exe)
