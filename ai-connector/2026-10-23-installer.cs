using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Win32;
class SceneBlockSetup : Form {
 const string Version="2.8.0",Key="Software\\Classes\\sceneblock";
 readonly string target=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SceneBlock","AI",Version);
 readonly Label status=new Label();
 [STAThread] static void Main(string[] args){if(args.Length==1&&args[0]=="--verify-payload"){Verify();return;}if(args.Length==2&&args[0]=="--preview"){Application.EnableVisualStyles();using(var form=new SceneBlockSetup())SceneBlockTheme.Render(form,args[1]);return;}if(args.Length==2&&args[0]=="--test-upgrade"){TestUpgrade(args[1]);return;}Application.EnableVisualStyles();Application.Run(new SceneBlockSetup());}
 static void Verify(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var z=new ZipArchive(stream,ZipArchiveMode.Read)){if(z.Entries.Count<9)throw new Exception("Incomplete payload");bool node=false,approval=false;foreach(var e in z.Entries){if(e.FullName.Contains("..")||Path.GetFileName(e.FullName)!=e.FullName)throw new Exception("Invalid payload path");if(e.FullName=="node.exe")node=true;if(e.FullName=="2026-10-25-SceneBlock-Approval.exe")approval=true;using(var s=e.Open())s.CopyTo(Stream.Null);}if(!node||!approval)throw new Exception("Missing runtime or approval UI");}}
 SceneBlockSetup(){SceneBlockTheme.Apply(this,"SceneBlock AI 설치 · 업데이트 v"+Version,new Size(680,420));SceneBlockTheme.Brand(this);
 SceneBlockTheme.Text(this,"AI 연결 프로그램 준비",28,65,624,38,20,SceneBlockTheme.Foreground);
 SceneBlockTheme.Text(this,"처음 설치하거나 기존 연결 프로그램을 업데이트합니다.\nCodex · Claude Code 로그인 정보와 이전 설치 폴더는 유지됩니다.\n설치 후 웹에서 AI 연결을 누르고 사이트 주소를 확인하세요.",28,116,624,84,10,SceneBlockTheme.Foreground);
 status.SetBounds(28,212,624,105);status.ForeColor=SceneBlockTheme.Muted;status.Text="연결 프로그램 v"+Version+" · 현재 Windows 사용자용\n설치 위치: "+target+"\n기존 연결이 사용 중이면 모든 탭에서 연결 해제 후 약 90초 기다리세요.";Controls.Add(status);
 var install=SceneBlockTheme.Button(this,"설치 · 업데이트 / 연결 복구",28,348,252,true);install.Click+=(s,e)=>Install();
 var web=SceneBlockTheme.Button(this,"SceneBlock 웹 열기",292,348,188,false);web.Click+=(s,e)=>Process.Start(new ProcessStartInfo("https://scene-block.vercel.app"){UseShellExecute=true});
 var close=SceneBlockTheme.Button(this,"닫기",522,348,130,false);close.Click+=(s,e)=>Close();CancelButton=close;}
 bool ConfirmInstall(){using(var form=new Form()){SceneBlockTheme.Apply(form,"SceneBlock AI 설치 확인",new Size(680,350));SceneBlockTheme.Brand(form);SceneBlockTheme.Text(form,"이 폴더에 설치하고 웹 연결을 등록합니다.",28,72,624,36,15,SceneBlockTheme.Foreground);SceneBlockTheme.Text(form,target,28,121,624,60,10,SceneBlockTheme.Foreground);SceneBlockTheme.Text(form,"현재 Windows 사용자에게만 적용됩니다.\n기존 로그인 정보와 이전 설치 폴더는 그대로 유지합니다.",28,192,624,60,10,SceneBlockTheme.Muted);var cancel=SceneBlockTheme.Button(form,"취소",348,282,138,false);cancel.DialogResult=DialogResult.Cancel;var yes=SceneBlockTheme.Button(form,"설치 / 업데이트",500,282,152,true);yes.DialogResult=DialogResult.OK;form.CancelButton=cancel;return form.ShowDialog(this)==DialogResult.OK;}}
 static void ExtractPayload(string folder){Verify();using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var z=new ZipArchive(stream,ZipArchiveMode.Read)){foreach(var e in z.Entries){var file=Path.Combine(folder,e.FullName);if(File.Exists(file)){using(var sha=SHA256.Create())using(var input=e.Open()){if(Convert.ToBase64String(sha.ComputeHash(File.ReadAllBytes(file)))!=Convert.ToBase64String(sha.ComputeHash(input)))throw new Exception("다른 내용의 기존 파일을 보존했습니다: "+file);}}}Directory.CreateDirectory(folder);foreach(var e in z.Entries){var file=Path.Combine(folder,e.FullName);if(!File.Exists(file))using(var input=e.Open())using(var output=new FileStream(file,FileMode.CreateNew))input.CopyTo(output);}}}
 static void TestUpgrade(string root){root=Path.GetFullPath(root);if(Directory.Exists(root))throw new Exception("Test folder already exists");Directory.CreateDirectory(root);var old=Path.Combine(root,"2.6.0");Directory.CreateDirectory(old);var original=Path.Combine(old,"settings-preservation.txt");File.WriteAllText(original,"keep existing login/settings marker");var previous=Path.Combine(root,"2.7.0");Directory.CreateDirectory(previous);var previousMarker=Path.Combine(previous,"settings-preservation.txt");File.WriteAllText(previousMarker,"keep previous 2.7.0 settings");var next=Path.Combine(root,Version);ExtractPayload(next);ExtractPayload(next);if(File.ReadAllText(previousMarker)!="keep previous 2.7.0 settings")throw new Exception("Previous 2.7.0 files changed");if(File.ReadAllText(original)!="keep existing login/settings marker")throw new Exception("Old files changed");var existing=Path.Combine(next,"2026-10-23-on-demand.mjs");File.AppendAllText(existing,"\n// existing modified file");bool refused=false;try{ExtractPayload(next);}catch{refused=true;}if(!refused||!File.ReadAllText(existing).EndsWith("// existing modified file"))throw new Exception("Existing-file guard failed");File.WriteAllText(Path.Combine(root,"2026-10-25-upgrade-test.txt"),"New version extraction OK; previous version preserved; identical reinstall OK; changed files refused; no registry, actual installation or CLI login modified");}
 void Install(){try{
 Verify();string command="\""+Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","wscript.exe")+"\" \""+Path.Combine(target,"2026-10-23-protocol.vbs")+"\" \"%1\"";
 string existing=null;using(var k=Registry.CurrentUser.OpenSubKey(Key+"\\shell\\open\\command")){if(k!=null)existing=k.GetValue("") as string;}
 if(existing!=null&&existing!=command&&!existing.Contains("\\SceneBlock\\AI\\"))throw new Exception("sceneblock 연결이 다른 프로그램에 등록되어 있습니다. 기존 설정을 보존했습니다.");
 if(!ConfirmInstall())return;
 ExtractPayload(target);
 if(existing!=null&&existing!=command){using(var k=Registry.CurrentUser.OpenSubKey(Key)){string backup=Path.Combine(target,"2026-10-25-previous-protocol-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")+".txt");File.WriteAllText(backup,"Command="+existing+"\r\nURL Protocol="+Convert.ToString(k.GetValue("URL Protocol")));}}
 using(var k=Registry.CurrentUser.CreateSubKey(Key)){k.SetValue("","URL:SceneBlock AI");k.SetValue("URL Protocol","");}using(var k=Registry.CurrentUser.CreateSubKey(Key+"\\shell\\open\\command"))k.SetValue("",command);
 status.Text="설치 · 업데이트 및 웹 연결 준비 완료.\n웹으로 돌아가 ‘AI 연결’을 누르고 앱 열기·사이트 사용을 승인하세요.";
 }catch(Exception e){status.Text="설치를 완료하지 못했습니다. 기존 파일은 보존했습니다.";MessageBox.Show(this,e.Message,Text,MessageBoxButtons.OK,MessageBoxIcon.Error);}}
}
