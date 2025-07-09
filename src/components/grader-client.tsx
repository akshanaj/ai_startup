"use client"

import { useState, useRef, useEffect } from "react"
import { gradeDocument } from "@/ai/flows/grade-document"
import { chatWithDocument } from "@/ai/flows/chat-with-document"
import { useToast } from "@/hooks/use-toast"
import { Loader2, GraduationCap, Sparkles, Bot, User } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput, ChatWithDocumentInput } from "@/ai/types";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


interface GradedDoc {
    id: string;
    question: string;
    answer: string;
    rubric: string;
    keywords: string;
    analysis: GradeDocumentOutput['analysis'];
    overallFeedback: string;
    score: number;
}

const example = {
    question: "Explain the process of photosynthesis.",
    rubric: "The explanation should be clear, accurate, and mention the roles of sunlight, water, carbon dioxide, chlorophyll, and the production of glucose and oxygen. Grading is out of 10 points.",
    answer: "Photosynthesis is how plants eat. They take in sunlight and water through their roots, and CO2 from the air. This happens in the leaves, which are green because of chlorophyll. The plant then makes sugar for food and releases oxygen for us to breathe. Water is actually absorbed from the soil by the leaves, not the roots.",
    keywords: "sunlight, water, carbon dioxide, chlorophyll, glucose, oxygen"
};

interface ChatMessage {
    role: 'user' | 'model';
    message: string;
}

export default function GraderClient() {
  const [isGrading, setIsGrading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  
  const [gradedDoc, setGradedDoc] = useState<GradedDoc | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const [gradeInput, setGradeInput] = useState<GradeDocumentInput>({ question: '', answer: '', rubric: '', keywords: '' });
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);


  const { toast } = useToast()

  useEffect(() => {
    // Scroll to the bottom of the chat history when it updates
    if (chatScrollAreaRef.current) {
        chatScrollAreaRef.current.scrollTo({ top: chatScrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);


  const loadExample = () => {
    setGradeInput(example);
  };

  const processAndSetGradedDoc = (doc: GradeDocumentOutput, input: GradeDocumentInput) => {
    let highlightedAnswer = input.answer;
    doc.analysis.forEach(item => {
        const sentimentClass = {
            positive: "bg-green-200/50 hover:bg-green-300/80",
            negative: "bg-red-200/50 hover:bg-red-300/80",
            neutral: "bg-yellow-200/50 hover:bg-yellow-300/80"
        }[item.sentiment];

        // Escape special characters in segment for regex
        const escapedSegment = item.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s|>)(${escapedSegment})(<|\\s|$)`, 'g');

        if (item.sentiment !== 'neutral') {
             highlightedAnswer = highlightedAnswer.replace(regex, `$1<mark id="${item.id}" class="${sentimentClass} p-1 rounded-md cursor-pointer transition-colors">${item.segment}</mark>$3`);
        }
    });

    setGradedDoc({
        ...input,
        id: `doc-${Date.now()}`,
        answer: highlightedAnswer,
        analysis: doc.analysis,
        overallFeedback: doc.overallFeedback,
        score: doc.score,
    });
  }
  
  const handleGrade = async () => {
    if (!gradeInput.question.trim() || !gradeInput.answer.trim() || !gradeInput.rubric.trim()) {
        toast({ title: "Missing fields", description: "Please provide a question, answer, and rubric.", variant: "destructive" });
        return;
    }
    setIsGrading(true);
    setGradedDoc(null);
    setChatHistory([]);
    try {
        const result = await gradeDocument(gradeInput);
        processAndSetGradedDoc(result, gradeInput);
    } catch (error) {
        console.error("Grading error:", error);
        toast({ title: "Grading Error", description: "Could not grade the document. Please try again.", variant: "destructive" });
    } finally {
        setIsGrading(false);
        setIsGradeDialogOpen(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !gradedDoc) return;

    const userMessage: ChatMessage = { role: 'user', message: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatting(true);

    try {
        const currentAnalysis: GradeDocumentOutput = {
            analysis: gradedDoc.analysis,
            overallFeedback: gradedDoc.overallFeedback,
            score: gradedDoc.score,
        };
        const chatFlowInput: ChatWithDocumentInput = {
            document: {
                question: gradedDoc.question,
                answer: gradedDoc.answer.replace(/<[^>]*>/g, ''), // Send clean text
                rubric: gradedDoc.rubric,
                keywords: gradedDoc.keywords,
            },
            currentAnalysis,
            userMessage: userMessage.message,
            chatHistory,
        };

        const result = await chatWithDocument(chatFlowInput);

        const modelMessage: ChatMessage = { role: 'model', message: result.llmResponse };
        setChatHistory(prev => [...prev, modelMessage]);

        // Update the document with the refined analysis
        processAndSetGradedDoc(result.updatedAnalysis, {
            question: gradedDoc.question,
            answer: gradedDoc.answer.replace(/<[^>]*>/g, ''), // Use clean answer for re-highlighting
            rubric: gradedDoc.rubric,
            keywords: gradedDoc.keywords,
        });


    } catch (error) {
        console.error("Chat error:", error);
        toast({ title: "Chat Error", description: "Could not get response from AI. Please try again.", variant: "destructive" });
        // remove the user message if there was an error
        setChatHistory(prev => prev.slice(0, -1));
    } finally {
        setIsChatting(false);
    }
  }

  const handleHighlightClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'MARK') {
        setActiveCommentId(target.id);
        const commentEl = document.getElementById(`comment-${target.id}`);
        if (commentEl) {
            commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a temporary visual indicator
            commentEl.classList.add('ring-2', 'ring-primary');
            setTimeout(() => {
                commentEl.classList.remove('ring-2', 'ring-primary');
            }, 1500);
        }
    }
  };
  
  const renderGrader = () => (
    <main className="grid grid-cols-12 gap-4 p-4 flex-grow overflow-hidden">
        {/* Comments Column */}
        <div className="col-span-12 md:col-span-3 order-2 md:order-1 h-full overflow-y-auto">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle>Analysis</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    {isGrading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : gradedDoc ? (
                        <ScrollArea className="h-[calc(100vh-200px)]">
                          <div className="space-y-4">
                              <Card>
                                <CardHeader>
                                    <CardDescription>Overall Feedback</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">{gradedDoc.overallFeedback}</p>

                                </CardContent>
                              </Card>
                              {gradedDoc.analysis.map((item) => {
                                  const sentimentBorder = {
                                    positive: "border-green-500",
                                    negative: "border-red-500",
                                    neutral: "border-border"
                                  }[item.sentiment];

                                  return (
                                  <Card key={item.id} id={`comment-${item.id}`} className={`transition-shadow hover:shadow-lg ${activeCommentId === item.id ? 'border-primary' : sentimentBorder}`}
                                    onClick={() => {
                                        const markEl = document.getElementById(item.id);
                                        if (markEl) {
                                            markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            setActiveCommentId(item.id);
                                        }
                                    }}
                                  >
                                      <CardHeader className="p-4">
                                          <p className="text-sm font-semibold text-muted-foreground italic">&quot;{item.segment}&quot;</p>
                                      </CardHeader>
                                      <CardContent className="p-4 pt-0">
                                          <p className="text-sm">{item.comment}</p>
                                      </CardContent>
                                  </Card>
                              )})}
                          </div>
                        </ScrollArea>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">
                            Comments & feedback will appear here after grading.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Document Column */}
        <div className="col-span-12 md:col-span-6 order-1 md:order-2 h-full overflow-y-auto">
            <Card className="h-full">
                 <CardHeader>
                    {gradedDoc && (
                         <div className="flex justify-between items-center">
                            <CardTitle>Graded Document</CardTitle>
                            <div className="text-2xl font-bold text-primary flex items-center gap-2">
                                <Sparkles className="w-6 h-6" />
                                <span>{gradedDoc.score} / 10</span>
                            </div>
                         </div>
                    )}
                </CardHeader>
                <CardContent className="p-6 h-full">
                    {isGrading ? (
                        <div className="space-y-4 p-8">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    ) : gradedDoc ? (
                        <ScrollArea className="h-[calc(100vh-200px)]">
                            <div className="p-4 font-body prose" onClick={handleHighlightClick} dangerouslySetInnerHTML={{ __html: gradedDoc.answer.replace(/\n/g, '<br />') }}></div>
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
                <CardContent className="flex-grow flex flex-col justify-between overflow-hidden">
                    <ScrollArea className="flex-grow h-0" ref={chatScrollAreaRef}>
                        <div className="space-y-4 p-4">
                            {chatHistory.length === 0 && !isChatting && (
                                <div className="text-center text-muted-foreground py-10">
                                    <Bot className="w-10 h-10 mx-auto mb-2"/>
                                    <p>After grading a document, you can ask Gemini to refine its analysis here.</p>
                                </div>
                            )}
                            {chatHistory.map((chat, index) => (
                                <div key={index} className={`flex gap-3 items-start ${chat.role === 'user' ? 'justify-end' : ''}`}>
                                    {chat.role === 'model' && <Avatar className="w-8 h-8"><AvatarFallback><Bot size={20}/></AvatarFallback></Avatar>}
                                    <div className={`rounded-lg p-3 text-sm max-w-[85%] ${chat.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        {chat.message}
                                    </div>
                                    {chat.role === 'user' && <Avatar className="w-8 h-8"><AvatarFallback><User size={20}/></AvatarFallback></Avatar>}
                                </div>
                            ))}
                             {isChatting && (
                                <div className="flex gap-3 items-start">
                                    <Avatar className="w-8 h-8"><AvatarFallback><Bot size={20}/></AvatarFallback></Avatar>
                                    <div className="rounded-lg p-3 text-sm bg-muted flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin"/> Thinking...
                                    </div>
                                </div>
                             )}
                        </div>
                    </ScrollArea>
                    <form onSubmit={handleChatSubmit} className="flex gap-2 p-2 border-t">
                        <Input
                            placeholder="Ask to refine the grade..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            disabled={!gradedDoc || isChatting}
                        />
                        <Button type="submit" disabled={!gradedDoc || isChatting || !chatInput.trim()}>
                            {isChatting ? <Loader2 className="animate-spin" /> : "Send"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    </main>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b border-border print:hidden shrink-0">
          <h1 className="text-2xl font-headline font-bold">DocuCraft Grader</h1>
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
                        <Textarea id="rubric" value={gradeInput.rubric} onChange={e => setGradeInput({...gradeInput, rubric: e.target.value})} className="col-span-3" placeholder="Enter the grading rubric, including total points (e.g., 'out of 10 points')..."/>
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
                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={loadExample}>Load Example</Button>
                    <Button type="submit" onClick={handleGrade} disabled={isGrading}>
                        {isGrading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {isGrading ? "Grading..." : "Grade"}
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>
        
        {renderGrader()}

      </div>
    </TooltipProvider>
  )
}
