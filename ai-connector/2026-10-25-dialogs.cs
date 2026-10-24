using System;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
public static class SceneBlockTheme {
 public static readonly Color Background=Color.FromArgb(24,28,35),Panel=Color.FromArgb(35,40,50),Foreground=Color.FromArgb(227,230,236),Muted=Color.FromArgb(166,181,199),Accent=Color.FromArgb(184,232,121);
 public static void Apply(Form form,string title,Size size){form.Text=title;form.ClientSize=size;form.BackColor=Background;form.ForeColor=Foreground;form.Font=new Font("Malgun Gothic",10);form.StartPosition=FormStartPosition.CenterScreen;form.FormBorderStyle=FormBorderStyle.FixedDialog;form.MaximizeBox=false;form.MinimizeBox=false;form.ShowIcon=false;form.AutoScaleMode=AutoScaleMode.Dpi;}
 public static Label Text(Form form,string text,int x,int y,int w,int h,float size,Color color){var label=new Label{Text=text,Location=new Point(x,y),Size=new Size(w,h),Font=new Font("Malgun Gothic",size),ForeColor=color,BackColor=Color.Transparent};form.Controls.Add(label);return label;}
 public static Button Button(Form form,string text,int x,int y,int w,bool primary){var button=new Button{Text=text,Location=new Point(x,y),Size=new Size(w,40),FlatStyle=FlatStyle.Flat,BackColor=primary?Accent:Panel,ForeColor=primary?Background:Foreground};button.FlatAppearance.BorderColor=primary?Accent:Color.FromArgb(75,85,100);form.Controls.Add(button);return button;}
 public static void Brand(Form form){Text(form,"SCENEBLOCK  ·  씬블록",28,22,570,27,14,Accent);}
 public static void Render(Form form,string file){form.ShowInTaskbar=false;form.Opacity=0;form.Show();Application.DoEvents();form.PerformLayout();using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(0,0,bitmap.Width,bitmap.Height));bitmap.Save(file,System.Drawing.Imaging.ImageFormat.Png);}form.Hide();form.Opacity=1;}
}
public class SceneBlockApproval : Form {
 public readonly Button Allow,Cancel;
 public SceneBlockApproval(string origin){SceneBlockTheme.Apply(this,"SceneBlock AI 연결 허용",new Size(640,360));SceneBlockTheme.Brand(this);
 SceneBlockTheme.Text(this,"AI 연결을 허용할까요?",28,65,584,38,20,SceneBlockTheme.Foreground);
 SceneBlockTheme.Text(this,"이 SceneBlock 사이트가 PC의 AI 연결 프로그램을\n사용하도록 허용할까요?",28,112,584,48,11,SceneBlockTheme.Foreground);
 var site=new Panel{Location=new Point(28,171),Size=new Size(584,51),BackColor=SceneBlockTheme.Panel};Controls.Add(site);site.Controls.Add(new Label{Text="연결할 사이트",Location=new Point(12,6),Size=new Size(550,17),ForeColor=SceneBlockTheme.Muted,Font=new Font("Malgun Gothic",9)});site.Controls.Add(new Label{Text=origin,Location=new Point(12,25),Size=new Size(550,21),ForeColor=SceneBlockTheme.Foreground,Font=new Font("Malgun Gothic",10)});
 SceneBlockTheme.Text(this,"허용 후에도 장면 설명을 입력하고 ‘장면 구성’을 눌러야\nAI 작업이 시작됩니다.",28,237,584,46,10,SceneBlockTheme.Muted);
 SceneBlockTheme.Text(this,"연결 프로그램 v2.7.0",28,313,245,26,9,SceneBlockTheme.Muted);
 Cancel=SceneBlockTheme.Button(this,"취소",322,300,130,false);Cancel.DialogResult=DialogResult.Cancel;
 Allow=SceneBlockTheme.Button(this,"연결 허용",466,300,146,true);Allow.DialogResult=DialogResult.OK;
 CancelButton=Cancel;ActiveControl=Cancel;
 }
 static DialogResult TestChoice(SceneBlockApproval form,Button button){form.Opacity=0;form.ShowInTaskbar=false;using(var timer=new Timer()){timer.Interval=30;timer.Tick+=(s,e)=>{timer.Stop();button.PerformClick();};timer.Start();return form.ShowDialog();}}
 static DialogResult TestDismiss(SceneBlockApproval form,bool escape){form.Opacity=0;form.ShowInTaskbar=false;using(var timer=new Timer()){timer.Interval=30;timer.Tick+=(s,e)=>{timer.Stop();if(escape)form.ProcessDialogKey(Keys.Escape);else form.Close();};timer.Start();return form.ShowDialog();}}
 static bool Trusted(string value){Uri u;if(!Uri.TryCreate(value,UriKind.Absolute,out u)||u.GetLeftPart(UriPartial.Authority)!=value||u.UserInfo!="")return false;return value=="https://scene-block.vercel.app"||u.Scheme=="http"&&(u.Host=="localhost"||u.Host=="127.0.0.1")&&(u.Port==4173||u.Port==4174||u.Port==5173||u.Port==5174||u.Port==8767);}
 [STAThread] public static int Main(string[] args){Application.EnableVisualStyles();
  if(args.Length==2&&args[0]=="--preview"){using(var f=new SceneBlockApproval("https://scene-block.vercel.app")){SceneBlockTheme.Render(f,args[1]);}return 0;}
  if(args.Length==2&&args[0]=="--self-test"){if(Directory.Exists(args[1]))throw new Exception("Test output exists");Directory.CreateDirectory(args[1]);using(var f=new SceneBlockApproval("https://scene-block.vercel.app")){SceneBlockTheme.Render(f,Path.Combine(args[1],"2026-10-25-approval.png"));if(TestChoice(f,f.Allow)!=DialogResult.OK)throw new Exception("Allow button failed");}using(var f=new SceneBlockApproval("https://scene-block.vercel.app")){if(TestChoice(f,f.Cancel)!=DialogResult.Cancel)throw new Exception("Cancel button failed");}using(var f=new SceneBlockApproval("https://scene-block.vercel.app")){if(TestDismiss(f,true)==DialogResult.OK)throw new Exception("Escape approved");}using(var f=new SceneBlockApproval("https://scene-block.vercel.app")){if(TestDismiss(f,false)==DialogResult.OK)throw new Exception("Close approved");}if(Trusted("https://scene-block.vercel.app.evil.test")||Trusted("https://scene-block.vercel.app/path")||Trusted("https://user@scene-block.vercel.app")||!Trusted("https://scene-block.vercel.app"))throw new Exception("Origin validation failed");File.WriteAllText(Path.Combine(args[1],"2026-10-25-dialog-test.txt"),"Allow OK; Cancel OK; Escape/Close do not approve; origin allowlist OK; no connection or installation performed");return 0;}
  if(args.Length==2&&args[0]=="--message"){using(var f=new Form()){SceneBlockTheme.Apply(f,"SceneBlock AI 연결 안내",new Size(640,290));SceneBlockTheme.Brand(f);SceneBlockTheme.Text(f,"연결 상태를 확인해 주세요",28,65,584,38,18,SceneBlockTheme.Foreground);SceneBlockTheme.Text(f,args[1],28,113,584,105,10,SceneBlockTheme.Foreground);var close=SceneBlockTheme.Button(f,"확인",466,231,146,true);close.DialogResult=DialogResult.OK;f.CancelButton=close;f.ShowDialog();}return 2;}
  if(args.Length!=2||args[0]!="--origin"||!Trusted(args[1]))return 3;
  using(var form=new SceneBlockApproval(args[1]))return form.ShowDialog()==DialogResult.OK?0:2;
 }
}
