param([Parameter(Mandatory=$true)][string]$FixturePath)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fixtureFull = [IO.Path]::GetFullPath($FixturePath)
if (!$fixtureFull.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture must be inside this project.' }
if (Test-Path -LiteralPath $fixtureFull) { throw 'Use a fresh fixture directory.' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exe = Join-Path $projectRoot 'tests\2026-10-25-installation-core-fixtures.exe'
& $compiler /nologo /r:System.Core.dll ('/out:'+$exe) (Join-Path $projectRoot 'ai-connector\2026-10-25-installation-manager.cs') (Join-Path $projectRoot 'tests\2026-10-25-installation-core-fixtures.cs')
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
& $exe $fixtureFull
if ($LASTEXITCODE -ne 0) { throw 'Lifecycle fixtures failed.' }
