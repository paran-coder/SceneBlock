param([string]$RequestUri='',[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
function ParseSceneBlockUri([string]$value){
 if($value.Length -gt 2048 -or $value -match '["\r\n]'){throw 'Invalid launch URI'}
 $u=[Uri]$value
 if($u.Scheme -cne 'sceneblock' -or $u.Host -cne 'start' -or $u.UserInfo -or $u.Port -ne -1 -or $u.Fragment -or $u.AbsolutePath -notin @('','/')){throw 'Invalid launch URI'}
 Add-Type -AssemblyName System.Web
 $q=[System.Web.HttpUtility]::ParseQueryString($u.Query)
 if($q.Count -ne 2 -or $q.GetValues('origin').Count -ne 1 -or $q.GetValues('nonce').Count -ne 1 -or $q['nonce'] -cnotmatch '^[0-9a-f]{64}$'){throw 'Invalid launch parameters'}
 $origin=$q['origin'];$site=[Uri]$origin
 $local=$site.Scheme -eq 'http' -and $site.Host -in @('localhost','127.0.0.1') -and $site.Port -in @(4173,4174,5173,5174,8767)
 if($site.UserInfo -or $origin -cne $site.GetLeftPart([UriPartial]::Authority) -or ($origin -cne 'https://scene-block.vercel.app' -and !$local)){throw 'Untrusted website'}
 return @{origin=$origin;nonce=$q['nonce']}
}
if($ValidateOnly){ParseSceneBlockUri $RequestUri|ConvertTo-Json -Compress;return}
try{
 $launch=ParseSceneBlockUri $RequestUri
 Add-Type -AssemblyName System.Windows.Forms
 if([Windows.Forms.MessageBox]::Show("SceneBlock에서 설치된 Codex 또는 Claude Code를 사용하도록 허용할까요?`n`n$($launch.origin)`n`n웹에서 장면 구성을 요청하기 전에는 AI 생성이나 설치를 실행하지 않습니다.",'SceneBlock AI - Approve website','YesNo','Question') -ne 'Yes'){return}
 $runtime=Join-Path $PSScriptRoot '2026-10-23-runtime';$tickets=Join-Path $runtime 'tickets';New-Item -ItemType Directory -Force -Path $tickets|Out-Null
 $mutex=New-Object Threading.Mutex($false,'Local\SceneBlockAI8768');$held=$false
 try{
  try{$held=$mutex.WaitOne(30000)}catch [Threading.AbandonedMutexException]{$held=$true};if(!$held){throw 'Another SceneBlock launch is pending.'}
  $sha=[Security.Cryptography.SHA256]::Create();try{$installId=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToLowerInvariant())))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  $health=$null;try{$health=Invoke-RestMethod 'http://127.0.0.1:8768/health' -TimeoutSec 2}catch{}
  if($health -and ($health.service -ne 'sceneblock-ai' -or $health.protocol -ne 2 -or $health.installation -ne $installId)){throw 'Port 8768 belongs to another installation or application. It was preserved.'}
  @{origin=$launch.origin;created=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $tickets ($launch.nonce+'.json')) -Encoding UTF8
  if($health){return}
  $node=Join-Path $PSScriptRoot 'node.exe';if(!(Test-Path -LiteralPath $node)){throw 'SceneBlock installation is incomplete. Run the installer again.'}
  $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
  $worker=Join-Path $PSScriptRoot '2026-10-23-on-demand.mjs'
  $child=Start-Process -FilePath $node -ArgumentList ('"'+$worker+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime '2026-10-23-output.log') -RedirectStandardError (Join-Path $runtime '2026-10-23-error.log')
  $ready=$false
  for($i=0;$i -lt 20;$i++){
   if($child.HasExited){throw 'SceneBlock AI failed to start. Run connection repair from the installer.'}
   try{$h=Invoke-RestMethod 'http://127.0.0.1:8768/health' -TimeoutSec 1;if($h.service -eq 'sceneblock-ai' -and $h.installation -eq $installId){$ready=$true;break}}catch{}
   Start-Sleep -Seconds 1
  }
  if(!$ready){throw 'SceneBlock AI startup timed out. Try AI connect again.'}
 }finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
}catch{Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($_.Exception.Message,'SceneBlock AI - Connection')|Out-Null}
