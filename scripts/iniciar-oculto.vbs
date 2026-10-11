' Abre o SOUL Cars sem mostrar o terminal. E o que o atalho "SOUL Cars" executa.
' Se algo falhar, mostra um aviso e o motivo fica em .tmp\iniciar.log.
Set shell = CreateObject("WScript.Shell")
Set arquivos = CreateObject("Scripting.FileSystemObject")
pasta = arquivos.GetParentFolderName(WScript.ScriptFullName)
codigo = shell.Run("cmd /c """"" & pasta & "\iniciar.cmd""""", 0, True)
If codigo <> 0 Then
  MsgBox "Nao foi possivel abrir o SOUL Cars." & vbCrLf & vbCrLf & _
    "Detalhes em: " & arquivos.GetParentFolderName(pasta) & "\.tmp\iniciar.log", 16, "SOUL Cars"
End If
