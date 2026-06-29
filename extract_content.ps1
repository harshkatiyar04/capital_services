$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("d:\expert property care\content\CS Website Content Layout.docx")
$text = $doc.Content.Text
$doc.Close()
$word.Quit()
Write-Output $text
