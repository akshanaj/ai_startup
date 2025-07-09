"use client"

import { useState, useRef, useCallback, useId } from "react"
import { semanticFormat } from "@/ai/flows/semantic-formatting"
import { gradeDocument } from "@/ai/flows/grade-document"
import { useToast } from "@/hooks/use-toast"
import { Bold, Italic, Underline, FileDown, Printer, Loader2, MessageSquare, GraduationCap } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput } from "@/ai/types";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

const styleOptions = ["Document", "Report", "Email", "Blog Post", "Formal Letter"];

interface GradedDoc {
    id: string;
    question: string;
    answer: string;
    rubric: string;
    keywords: string;
    analysis: GradeDocumentOutput['analysis'];
    overallFeedback: string;
}

export default function DocuCraftClient() {
  const [view, setView] = useState<'editor' | 'grader'>('editor');
  
  // Editor State
  const [inputText, setInputText] = useState("")
  const [formattedText, setFormattedText] = useState("")
  const [selectedStyle, setSelectedStyle] = useState(styleOptions[0])
  const [isFormatting, setIsFormatting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Grader State
  const [isGrading, setIsGrading] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [gradedDoc, setGradedDoc] = useState<GradedDoc | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const [gradeInput, setGradeInput] = useState<GradeDocumentInput>({ question: '', answer: '', rubric: '', keywords: '' });

  const { toast } = useToast()

  const handleFormat = useCallback(async () => {
    if (!inputText.trim()) {
      toast({
        title: "Input required",
        description: "Please enter some text to format.",
        variant: "destructive",
      })
      return
    }

    setIsFormatting(true)
    setFormattedText("")
    try {
      const result = await semanticFormat({ text: inputText, style: selectedStyle })
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
      setIsFormatting(false)
    }
  }, [inputText, selectedStyle, toast])
  
  const handleGrade = async () => {
    if (!gradeInput.question.trim() || !gradeInput.answer.trim() || !gradeInput.rubric.trim()) {
        toast({ title: "Missing fields", description: "Please provide a question, answer, and rubric.", variant: "destructive" });
        return;
    }
    setIsGrading(true);
    setGradedDoc(null);
    try {
        const result = await gradeDocument(gradeInput);
        
        let highlightedAnswer = gradeInput.answer;
        result.analysis.forEach(item => {
            highlightedAnswer = highlightedAnswer.replace(item.segment, `<mark id="${item.id}" class="bg-yellow-200/50 p-1 rounded-md cursor-pointer hover:bg-yellow-300/80 transition-colors">${item.segment}</mark>`);
        });

        setGradedDoc({
            ...gradeInput,
            id: `doc-${Date.now()}`,
            answer: highlightedAnswer,
            analysis: result.analysis,
            overallFeedback: result.overallFeedback,
        });
        
    } catch (error) {
        console.error("Grading error:", error);
        toast({ title: "Grading Error", description: "Could not grade the document. Please try again.", variant: "destructive" });
    } finally {
        setIsGrading(false);
        setIsGradeDialogOpen(false);
    }
  };

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

  const handleHighlightClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK') {
        setActiveCommentId(target.id);
        document.getElementById(`comment-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  const renderEditor = () => (
    <>
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
          <Button onClick={handleFormat} disabled={isFormatting || !inputText.trim()} className="w-full shrink-0">
            {isFormatting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFormatting ? "Formatting..." : "Format Document"}
          </Button>
        </div>
        
        <div className="flex flex-col h-full overflow-hidden">
          <Card className="flex-grow w-full bg-card printable-area overflow-auto">
            <CardContent className="p-8 font-body output-document">
              {isFormatting ? (
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
    </>
  );

  const renderGrader = () => (
    <main className="grid grid-cols-12 gap-4 p-4 flex-grow overflow-hidden">
        {/* Comments Column */}
        <div className="col-span-12 md:col-span-3 order-2 md:order-1 h-full overflow-y-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent>
                    {isGrading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : gradedDoc ? (
                        <ScrollArea className="h-[calc(100vh-200px)]">
                          <div className="space-y-4">
                              {gradedDoc.analysis.map((item) => (
                                  <Card key={item.id} id={`comment-${item.id}`} className={`transition-all ${activeCommentId === item.id ? 'border-primary ring-2 ring-primary' : ''}`}>
                                      <CardHeader className="p-4">
                                          <p className="text-sm font-semibold text-muted-foreground italic">&quot;{item.segment}&quot;</p>
                                      </CardHeader>
                                      <CardContent className="p-4 pt-0">
                                          <p className="text-sm">{item.comment}</p>
                                      </CardContent>
                                  </Card>
                              ))}
                          </div>
                        </ScrollArea>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            Comments will appear here after grading.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Document Column */}
        <div className="col-span-12 md:col-span-6 order-1 md:order-2 h-full overflow-y-auto">
            <Card className="h-full">
                <CardContent className="p-6 h-full">
                    {isGrading ? (
                        <div className="space-y-4 p-8">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    ) : gradedDoc ? (
                        <ScrollArea className="h-[calc(100vh-140px)]">
                            <div className="p-4 font-body" onClick={handleHighlightClick} dangerouslySetInnerHTML={{ __html: gradedDoc.answer }}></div>
                        </ScrollArea>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <GraduationCap className="w-16 h-16 mb-4"/>
                            <h2 className="text-xl font-semibold">Grade a Document</h2>
                            <p className="text-sm">Click the "Grade Document" button to start.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Chatbot Column */}
        <div className="col-span-12 md:col-span-3 order-3 h-full overflow-y-auto">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Chat with Gemini</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                  <div className="text-center text-muted-foreground flex-grow flex items-center justify-center">
                    <p>Chatbot coming soon.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Ask about the feedback..." disabled/>
                    <Button disabled>Send</Button>
                  </div>
                </CardContent>
            </Card>
        </div>
    </main>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b border-border print:hidden shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-headline font-bold">DocuCraft</h1>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                <Button variant={view === 'editor' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('editor')}>Editor</Button>
                <Button variant={view === 'grader' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grader')}>Grader</Button>
            </div>
          </div>
          
          {view === 'editor' && (
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
                      <Button variant="ghost" size="icon" onClick={handleExportMD} disabled={!formattedText || isFormatting}>
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
                      <Button variant="ghost" size="icon" onClick={handleExportPDF} disabled={!formattedText || isFormatting}>
                          <Printer className="w-5 h-5" />
                          <span className="sr-only">Export as PDF</span>
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Export as PDF</p>
                  </TooltipContent>
              </Tooltip>
            </div>
          )}
          {view === 'grader' && (
             <Dialog open={isGradeDialogOpen} onOpenChange={setIsGradeDialogOpen}>
                <DialogTrigger asChild>
                    <Button><GraduationCap className="mr-2"/> Grade Document</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Grade a Document</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="question" className="text-right">Question</Label>
                            <Textarea id="question" value={gradeInput.question} onChange={e => setGradeInput({...gradeInput, question: e.target.value})} className="col-span-3" placeholder="Enter the question..." />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="rubric" className="text-right">Rubric</Label>
                            <Textarea id="rubric" value={gradeInput.rubric} onChange={e => setGradeInput({...gradeInput, rubric: e.target.value})} className="col-span-3" placeholder="Enter the grading rubric or criteria..."/>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="keywords" className="text-right">Keywords</Label>
                            <Input id="keywords" value={gradeInput.keywords} onChange={e => setGradeInput({...gradeInput, keywords: e.target.value})} className="col-span-3" placeholder="Optional: comma-separated keywords..."/>
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label htmlFor="answer" className="text-right pt-2">Answer</Label>
                            <Textarea id="answer" value={gradeInput.answer} onChange={e => setGradeInput({...gradeInput, answer: e.target.value})} className="col-span-3 min-h-[200px]" placeholder="Paste the answer text here."/>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" onClick={handleGrade} disabled={isGrading}>
                            {isGrading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {isGrading ? "Grading..." : "Grade"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
          )}
        </header>
        
        {view === 'editor' ? renderEditor() : renderGrader()}

      </div>
    </TooltipProvider>
  )
}
