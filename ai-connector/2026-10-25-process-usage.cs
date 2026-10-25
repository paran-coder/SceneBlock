using System;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public static class SceneBlockProcessUsage {
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int id);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr handle,int flags,StringBuilder name,ref int size);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 public static string ProcessPath(int id){IntPtr handle=IntPtr.Zero;try{handle=OpenProcess(0x1000,false,id);if(handle==IntPtr.Zero)return null;int size=32768;var name=new StringBuilder(size);return QueryFullProcessImageName(handle,0,name,ref size)?name.ToString():null;}catch(InvalidOperationException){return null;}finally{if(handle!=IntPtr.Zero)CloseHandle(handle);}}
 public static Dictionary<int,string> Processes(){var paths=new Dictionary<int,string>();foreach(var process in Process.GetProcesses())using(process){try{var path=ProcessPath(process.Id);if(path!=null)paths[process.Id]=path;}catch(InvalidOperationException){}}return paths;}
 public static IEnumerable<string> Paths(){return Processes().Values;}
 public static bool Locked(string file){if(!File.Exists(file))return false;try{using(var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.None))return false;}catch(IOException){return true;}catch(UnauthorizedAccessException){return true;}}
 public static bool IsBusy(string folder,IEnumerable<string> paths,Func<string,bool> locked,string self=null){folder=Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;self=self==null?null:Path.GetFullPath(self);foreach(string path in paths){string full=Path.GetFullPath(path);if(full.StartsWith(folder,StringComparison.OrdinalIgnoreCase)&&!String.Equals(full,self,StringComparison.OrdinalIgnoreCase))return true;}foreach(string name in new[]{"node.exe","2026-10-25-SceneBlock-Approval.exe","2026-10-25-SceneBlock-Manager.exe"}){string file=Path.Combine(folder,name);if(String.Equals(file,self,StringComparison.OrdinalIgnoreCase))continue;try{if(locked(file))return true;}catch{return true;}}return false;}
}
