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
 const string Version="2.6.0",Key="Software\\Classes\\sceneblock";
 readonly string target=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SceneBlock","AI",Version);
 readonly Label status=new Label();
 [STAThread] static void Main(string[] args){if(args.Length==1&&args[0]=="--verify-payload"){Verify();return;}Application.EnableVisualStyles();Application.Run(new SceneBlockSetup());}
 static void Verify(){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var z=new ZipArchive(stream,ZipArchiveMode.Read)){if(z.Entries.Count<9)throw new Exception("Incomplete payload");bool node=false;foreach(var e in z.Entries){if(e.FullName.Contains("..")||Path.GetFileName(e.FullName)!=e.FullName)throw new Exception("Invalid payload path");if(e.FullName=="node.exe")node=true;using(var s=e.Open())s.CopyTo(Stream.Null);}if(!node)throw new Exception("Missing runtime");}}
 SceneBlockSetup(){Text="SceneBlock AI 설치 · 연결 복구 v"+Version;ClientSize=new Size(640,360);Font=new Font("Malgun Gothic",10);StartPosition=FormStartPosition.CenterScreen;BackColor=Color.White;
 Controls.Add(new Label{Text="SceneBlock AI 연결 준비",Font=new Font(Font.FontFamily,20,FontStyle.Bold),Location=new Point(26,25),AutoSize=true});
 Controls.Add(new Label{Text="처음 한 번 설치하면 웹의 ‘AI 연결’ 버튼으로 시작합니다.\n별도 실행 창이나 연결 코드를 사용할 필요가 없습니다.\nCodex·Claude Code 설치와 로그인은 웹의 AI 설정 안내를 따르세요.",Location=new Point(28,85),Size=new Size(584,80)});
 status.SetBounds(28,180,584,75);status.Text="Node 실행 환경이 포함되어 있습니다. 모델은 설치하지 않습니다.\n설치 위치: "+target;Controls.Add(status);
 var install=new Button{Text="설치 / 연결 복구",Location=new Point(28,278),Size=new Size(180,42)};install.Click+=(s,e)=>Install();Controls.Add(install);
 var web=new Button{Text="SceneBlock 웹 열기",Location=new Point(222,278),Size=new Size(180,42)};web.Click+=(s,e)=>Process.Start(new ProcessStartInfo("https://scene-block.vercel.app"){UseShellExecute=true});Controls.Add(web);
 var close=new Button{Text="닫기",Location=new Point(490,278),Size=new Size(120,42)};close.Click+=(s,e)=>Close();Controls.Add(close);}
 void Install(){try{
 Verify();string command="\""+Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","wscript.exe")+"\" \""+Path.Combine(target,"2026-10-23-protocol.vbs")+"\" \"%1\"";
 string existing=null;using(var k=Registry.CurrentUser.OpenSubKey(Key+"\\shell\\open\\command")){if(k!=null)existing=k.GetValue("") as string;}
 if(existing!=null&&existing!=command&&!existing.Contains("\\SceneBlock\\AI\\"))throw new Exception("sceneblock 연결이 다른 프로그램에 등록되어 있습니다. 기존 설정을 보존했습니다.");
 if(MessageBox.Show(this,"다음 폴더에 AI 연결 기능을 설치하고 웹 실행 주소를 등록합니다.\n\n"+target+"\n\n현재 사용자만 적용합니다. 시작 프로그램·상주 서비스·AI 모델은 추가하지 않습니다.\n기존 Codex/Claude 로그인 정보는 수정하지 않습니다.\n\n진행할까요?",Text,MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
 // Preflight the complete package before any file is written. Changed existing files are never overwritten.
 using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))using(var z=new ZipArchive(stream,ZipArchiveMode.Read)){
 foreach(var e in z.Entries){var file=Path.Combine(target,e.FullName);if(File.Exists(file)){using(var sha=SHA256.Create())using(var input=e.Open()){if(Convert.ToBase64String(sha.ComputeHash(File.ReadAllBytes(file)))!=Convert.ToBase64String(sha.ComputeHash(input)))throw new Exception("다른 내용의 기존 파일을 보존했습니다: "+file);}}}
 Directory.CreateDirectory(target);foreach(var e in z.Entries){var file=Path.Combine(target,e.FullName);if(!File.Exists(file))using(var input=e.Open())using(var output=new FileStream(file,FileMode.CreateNew))input.CopyTo(output);}}
 if(existing!=null&&existing!=command){using(var k=Registry.CurrentUser.OpenSubKey(Key)){string backup=Path.Combine(target,"2026-10-23-previous-protocol-"+DateTime.UtcNow.ToString("yyyyMMddHHmmssfff")+".txt");File.WriteAllText(backup,"Command="+existing+"\r\nURL Protocol="+Convert.ToString(k.GetValue("URL Protocol")));}}
 using(var k=Registry.CurrentUser.CreateSubKey(Key)){k.SetValue("","URL:SceneBlock AI");k.SetValue("URL Protocol","");}using(var k=Registry.CurrentUser.CreateSubKey(Key+"\\shell\\open\\command"))k.SetValue("",command);
 status.Text="설치 및 웹 연결 준비 완료.\n웹으로 돌아가 ‘AI 연결’을 누르고 앱 열기·사이트 사용을 승인하세요.";
 }catch(Exception e){status.Text="설치를 완료하지 못했습니다. 기존 파일은 보존했습니다.";MessageBox.Show(this,e.Message,Text,MessageBoxButtons.OK,MessageBoxIcon.Error);}}
}
