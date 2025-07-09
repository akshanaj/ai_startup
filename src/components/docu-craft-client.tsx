"use client"

import { useState, useRef, useCallback } from "react"
import { semanticFormat } from "@/ai/flows/semantic-formatting"
import { useToast } from "@/hooks/use-toast"
import { Bold, Italic, Underline, FileDown, Printer, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"

const styleOptions = ["Document", "Report", "Email", "Blog Post", "Formal Letter"];

export default function DocuCraftClient() {
  const [inputText, setInputText] = useState("")
  const [formattedText, setFormattedText] = useState("")
  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFormat = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input required",
        description: "Please enter some text to format.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    setFormattedText("")
    try {
      const result = await semanticFormat({ text: inputText, style: selectedStyle })
      // Replace markdown-like bold/italic with HTML tags for display.
      let htmlResult = result.formattedText
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br />');
      setFormattedText(htmlResult)
    } catch (error) {
      console.error("Formatting error:", error)
      toast({
        title: "Formatting Error",
        description: "Could not format the text. Please try again later.",
        variant: "destructive",
      })
      setFormattedText("Error: Could not format document.")
    } finally {
      setIsLoading(false)
    }
  }, [inputText, selectedStyle, toast])

  const applyFormatting = (tag: 'bold' | 'italic' | 'underline') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = inputText.substring(start, end)
    
    if (!selectedText) {
      toast({ title: "No text selected", description: "Please select text to format."})
      return;
    }

    let replacement = ''
    switch (tag) {
        case 'bold':
            replacement = `**${selectedText}**`
            break;
        case 'italic':
            replacement = `*${selectedText}*`
            break;
        case 'underline':
            replacement = `<u>${selectedText}</u>`
            break;
    }

    setInputText(inputText.substring(0, start) + replacement + inputText.substring(end))
    
    setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start, start + replacement.length)
    }, 0)
  }

  const handleExportMD = () => {
    if (!formattedText) return
    const blob = new Blob([formattedText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "docucraft-document.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportPDF = () => {
    window.print()
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b border-border print:hidden shrink-0">
          <h1 className="text-2xl font-headline font-bold">DocuCraft</h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue placeholder="Select a style" />
              </SelectTrigger>
              <SelectContent>
                {styleOptions.map(style => (
                  <SelectItem key={style} value={style}>{style}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleExportMD} disabled={!formattedText || isLoading}>
                        <FileDown className="w-5 h-5" />
                        <span className="sr-only">Export as Markdown</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Export as Markdown</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleExportPDF} disabled={!formattedText || isLoading}>
                        <Printer className="w-5 h-5" />
                        <span className="sr-only">Export as PDF</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Export as PDF</p>
                </TooltipContent>
            </Tooltip>
          </div>
        </header>
        
        <main className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">
          <div className="flex flex-col gap-4 print:hidden h-full">
            <div className="flex items-center justify-between p-1 border rounded-md shrink-0">
                <div className="flex gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => applyFormatting('bold')}><Bold className="w-4 h-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Bold</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => applyFormatting('italic')}><Italic className="w-4 h-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Italic</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => applyFormatting('underline')}><Underline className="w-4 h-4" /></Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Underline</p></TooltipContent>
                    </Tooltip>
                </div>
            </div>
            <Textarea 
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type or paste your content here..."
              className="flex-grow w-full h-full resize-none text-base"
            />
            <Button onClick={handleFormat} disabled={isLoading || !inputText.trim()} className="w-full shrink-0">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Formatting..." : "Format Document"}
            </Button>
          </div>
          
          <div className="flex flex-col h-full overflow-hidden">
            <Card className="flex-grow w-full bg-card printable-area overflow-auto">
              <CardContent className="p-8 font-body output-document">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                    </div>
                ) : formattedText ? (
                  <div dangerouslySetInnerHTML={{ __html: formattedText }} />
                ) : (
                  <div className="text-muted-foreground h-full flex items-center justify-center">Your formatted document will appear here.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}