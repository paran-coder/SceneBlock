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
 $approval=Join-Path $PSScriptRoot '2026-10-25-SceneBlock-Approval.exe'
 if(!(Test-Path -LiteralPath $approval)){throw '승인 화면 파일이 없습니다. 최신 설치 프로그램에서 연결 복구를 실행하세요.'}
 $decision=Start-Process -FilePath $approval -ArgumentList ('--origin "'+$launch.origin+'"') -Wait -PassThru -WindowStyle Normal
 if($decision.ExitCode -ne 0){return}

 $runtime=Join-Path $PSScriptRoot '2026-10-23-runtime';$tickets=Join-Path $runtime 'tickets';New-Item -ItemType Directory -Force -Path $tickets|Out-Null
 $mutex=New-Object Threading.Mutex($false,'Local\SceneBlockAI8768');$held=$false
 try{
  try{$held=$mutex.WaitOne(30000)}catch [Threading.AbandonedMutexException]{$held=$true};if(!$held){throw '다른 연결 요청을 처리 중입니다. 잠시 후 다시 연결하세요.'}
  $sha=[Security.Cryptography.SHA256]::Create();try{$installId=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($PSScriptRoot.ToLowerInvariant())))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  $health=$null;try{$health=Invoke-RestMethod 'http://127.0.0.1:8768/health' -TimeoutSec 2}catch{}
  if($health -and ($health.service -ne 'sceneblock-ai' -or $health.protocol -ne 2 -or $health.installation -ne $installId)){throw '다른 버전 또는 프로그램이 연결을 사용 중입니다. 모든 SceneBlock 탭에서 연결 해제 후 약 90초 기다렸다가 다시 연결하세요.'}
  @{origin=$launch.origin;created=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()}|ConvertTo-Json -Compress|Set-Content -LiteralPath (Join-Path $tickets ($launch.nonce+'.json')) -Encoding UTF8
  if($health){return}
  $node=Join-Path $PSScriptRoot 'node.exe';if(!(Test-Path -LiteralPath $node)){throw '실행 파일을 찾지 못했습니다. 최신 설치 프로그램에서 연결 복구를 실행하세요.'}
  $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
  $worker=Join-Path $PSScriptRoot '2026-10-23-on-demand.mjs'
  $child=Start-Process -FilePath $node -ArgumentList ('"'+$worker+'"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime '2026-10-23-output.log') -RedirectStandardError (Join-Path $runtime '2026-10-23-error.log')
  $ready=$false
  for($i=0;$i -lt 20;$i++){
   if($child.HasExited){throw '연결 프로그램을 시작하지 못했습니다. 설치 프로그램에서 연결 복구를 실행하세요.'}
   try{$h=Invoke-RestMethod 'http://127.0.0.1:8768/health' -TimeoutSec 1;if($h.service -eq 'sceneblock-ai' -and $h.installation -eq $installId){$ready=$true;break}}catch{}
   Start-Sleep -Seconds 1
  }
  if(!$ready){throw '연결 준비 시간이 초과되었습니다. 잠시 후 AI 연결을 다시 누르세요.'}
 }finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
}catch{Add-Type -AssemblyName System.Windows.Forms;if($approval -and (Test-Path -LiteralPath $approval)){$message=$_.Exception.Message.Replace('"','');Start-Process -FilePath $approval -ArgumentList ('--message "'+$message+'"') -Wait -WindowStyle Normal|Out-Null}else{[Windows.Forms.MessageBox]::Show('최신 SceneBlock 설치 프로그램에서 연결 복구를 실행하세요.','SceneBlock AI 연결 안내')|Out-Null}}
