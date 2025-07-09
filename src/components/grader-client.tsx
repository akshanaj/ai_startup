"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { gradeDocument } from "@/ai/flows/grade-document"
import { chatWithDocument } from "@/ai/flows/chat-with-document"
import { useToast } from "@/hooks/use-toast"
import { Loader2, GraduationCap, Sparkles, Bot, User, ChevronDown } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput, ChatWithDocumentInput } from "@/ai/types";
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Student {
    id: string;
    name: string;
    answers: string[]; // answer[i] corresponds to question[i]
}

interface Question {
    id: string;
    text: string;
    rubric: string;
    keywords: string;
}

interface GradingResult {
    analysis: GradeDocumentOutput['analysis'];
    overallFeedback: string;
    score: number;
    highlightedAnswer: string;
}

const example = {
    questions: [
        { id: 'q1', text: "Explain the process of photosynthesis.", rubric: "The explanation should be clear, accurate, and mention the roles of sunlight, water, carbon dioxide, chlorophyll, and the production of glucose and oxygen. Grading is out of 10 points.", keywords: "sunlight, water, carbon dioxide, chlorophyll, glucose, oxygen" },
        { id: 'q2', text: "What is the primary function of the mitochondria in a cell?", rubric: "The answer must state that mitochondria are responsible for generating most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy. Grading is out of 5 points.", keywords: "ATP, energy, powerhouse, cellular respiration" }
    ],
    students: [
        { id: 's1', name: 'Alice', answers: ["Photosynthesis is how plants eat. They take in sunlight and water through their roots, and CO2 from the air. This happens in the leaves, which are green because of chlorophyll. The plant then makes sugar for food and releases oxygen for us to breathe.", "The mitochondria is the powerhouse of the cell, it makes energy."] },
        { id: 's2', name: 'Bob', answers: ["Plants use photosynthesis to make food from the sun. Chlorophyll is important. They take in CO2 and release O2.", "Mitochondria produce ATP through a process called cellular respiration, providing the main energy source for the cell."] }
    ]
};

interface ChatMessage {
    role: 'user' | 'model';
    message: string;
}

export default function GraderClient() {
  const [isGrading, setIsGrading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [gradingResults, setGradingResults] = useState<Record<string, Record<string, GradingResult>>>({}); // [questionId][studentId]

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast()

  const currentQuestion = questions[activeQuestionIndex];
  const currentGradingResult = useMemo(() => {
    if (!currentQuestion || !activeStudentId) return null;
    return gradingResults[currentQuestion.id]?.[activeStudentId] ?? null;
  }, [gradingResults, currentQuestion, activeStudentId]);

  useEffect(() => {
    if (students.length > 0 && !activeStudentId) {
        setActiveStudentId(students[0].id);
    }
  }, [students, activeStudentId]);

  useEffect(() => {
    if (chatScrollAreaRef.current) {
        chatScrollAreaRef.current.scrollTo({ top: chatScrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatHistory]);

  const loadExample = () => {
    setQuestions(example.questions);
    setStudents(example.students);
    setActiveQuestionIndex(0);
    setActiveStudentId(example.students[0]?.id);
  };

  const processAndSetGradedDoc = (doc: GradeDocumentOutput, student: Student, question: Question) => {
    const studentAnswer = student.answers[questions.findIndex(q => q.id === question.id)]
    let highlightedAnswer = studentAnswer;
    doc.analysis.forEach(item => {
        const sentimentClass = {
            positive: "bg-green-200/50 hover:bg-green-300/80",
            negative: "bg-red-200/50 hover:bg-red-300/80",
            neutral: "bg-yellow-200/50 hover:bg-yellow-300/80"
        }[item.sentiment];

        const escapedSegment = item.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s|>)(${escapedSegment})(<|\\s|$)`, 'g');

        if (item.sentiment !== 'neutral') {
             highlightedAnswer = highlightedAnswer.replace(regex, `$1<mark id="${item.id}" class="${sentimentClass} p-1 rounded-md cursor-pointer transition-colors">${item.segment}</mark>$3`);
        }
    });

    setGradingResults(prev => ({
        ...prev,
        [question.id]: {
            ...prev[question.id],
            [student.id]: {
                ...doc,
                highlightedAnswer
            }
        }
    }));
  }
  
  const handleGrade = async () => {
    if (questions.length === 0 || students.length === 0) {
        toast({ title: "Missing Data", description: "Please load example data first.", variant: "destructive" });
        return;
    }
    setIsGrading(true);
    setGradingResults({}); // Clear previous results
    try {
        for (const question of questions) {
            for (const student of students) {
                const gradeInput: GradeDocumentInput = {
                    question: question.text,
                    answer: student.answers[questions.findIndex(q => q.id === question.id)],
                    rubric: question.rubric,
                    keywords: question.keywords,
                    studentId: student.id,
                    questionId: question.id,
                };
                const result = await gradeDocument(gradeInput);
                processAndSetGradedDoc(result, student, question);
            }
        }
    } catch (error) {
        console.error("Grading error:", error);
        toast({ title: "Grading Error", description: "Could not grade the documents. Please try again.", variant: "destructive" });
    } finally {
        setIsGrading(false);
        setIsGradeDialogOpen(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentQuestion || !activeStudentId) return;

    const student = students.find(s => s.id === activeStudentId);
    if (!student || !currentGradingResult) return;

    const userMessage: ChatMessage = { role: 'user', message: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatting(true);

    try {
        const currentAnalysis: GradeDocumentOutput = {
            analysis: currentGradingResult.analysis,
            overallFeedback: currentGradingResult.overallFeedback,
            score: currentGradingResult.score,
        };
        const studentAnswer = student.answers[questions.findIndex(q => q.id === currentQuestion.id)];

        const chatFlowInput: ChatWithDocumentInput = {
            document: {
                question: currentQuestion.text,
                answer: studentAnswer,
                rubric: currentQuestion.rubric,
                keywords: currentQuestion.keywords,
                studentId: student.id,
                questionId: currentQuestion.id
            },
            currentAnalysis,
            userMessage: userMessage.message,
            chatHistory,
        };

        const result = await chatWithDocument(chatFlowInput);

        const modelMessage: ChatMessage = { role: 'model', message: result.llmResponse };
        setChatHistory(prev => [...prev, modelMessage]);

        processAndSetGradedDoc(result.updatedAnalysis, student, currentQuestion);

    } catch (error) {
        console.error("Chat error:", error);
        toast({ title: "Chat Error", description: "Could not get response from AI. Please try again.", variant: "destructive" });
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
            commentEl.classList.add('ring-2', 'ring-primary');
            setTimeout(() => {
                commentEl.classList.remove('ring-2', 'ring-primary');
            }, 1500);
        }
    }
  };

  const isDataLoaded = questions.length > 0 && students.length > 0;
  const areResultsLoaded = Object.keys(gradingResults).length > 0;
  
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
                    ) : areResultsLoaded && currentGradingResult ? (
                        <ScrollArea className="h-[calc(100vh-200px)]">
                          <div className="space-y-4">
                              <Card>
                                <CardHeader>
                                    <CardDescription>Overall Feedback</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">{currentGradingResult.overallFeedback}</p>
                                </CardContent>
                              </Card>
                              {currentGradingResult.analysis.map((item) => {
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
                            {isDataLoaded ? 'Click "Start Grading" to see results.' : 'Load data to begin.'}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Document Column */}
        <div className="col-span-12 md:col-span-6 order-1 md:order-2 h-full overflow-y-auto flex flex-col gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                Question {activeQuestionIndex + 1}: {currentQuestion ? (currentQuestion.text.substring(0, 30) + '...') : 'Select Question'}
                                <ChevronDown className="w-4 h-4 ml-2" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {questions.map((q, index) => (
                                <DropdownMenuItem key={q.id} onSelect={() => setActiveQuestionIndex(index)}>
                                    Question {index + 1}: {q.text}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                     {currentGradingResult && (
                        <div className="text-2xl font-bold text-primary flex items-center gap-2">
                            <Sparkles className="w-6 h-6" />
                            <span>{currentGradingResult.score} / 10</span>
                        </div>
                    )}
                </CardHeader>
            </Card>
            <Card className="flex-grow">
                <CardContent className="p-0 h-full">
                    {!isDataLoaded ? (
                         <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <GraduationCap className="w-16 h-16 mb-4"/>
                            <h2 className="text-xl font-semibold">Grade Documents</h2>
                            <p className="text-sm">Click "Load Data" to start.</p>
                        </div>
                    ) : (
                        <Tabs value={activeStudentId ?? undefined} onValueChange={setActiveStudentId} className="h-full flex flex-col">
                            <TabsList className="m-2">
                                {students.map(s => (
                                    <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
                                ))}
                            </TabsList>
                            {students.map(s => (
                                <TabsContent key={s.id} value={s.id} className="flex-grow h-0">
                                {isGrading ? (
                                    <div className="space-y-4 p-8">
                                        <Skeleton className="h-8 w-3/4" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-5/6" />
                                    </div>
                                ) : currentGradingResult ? (
                                    <ScrollArea className="h-full">
                                        <div className="p-4 font-body prose" onClick={handleHighlightClick} dangerouslySetInnerHTML={{ __html: currentGradingResult.highlightedAnswer.replace(/\n/g, '<br />') }}></div>
                                    </ScrollArea>
                                ) : (
                                    <div className="p-4">{s.answers[activeQuestionIndex]}</div>
                                )}
                                </TabsContent>
                            ))}
                        </Tabs>
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
                                    <p>After grading, you can ask Gemini to refine its analysis here.</p>
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
                            disabled={!currentGradingResult || isChatting}
                        />
                        <Button type="submit" disabled={!currentGradingResult || isChatting || !chatInput.trim()}>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={loadExample}>Load Example Data</Button>
            <Button onClick={handleGrade} disabled={isGrading || !isDataLoaded}>
                {isGrading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {isGrading ? "Grading..." : <><GraduationCap className="mr-2"/> Start Grading</>}
            </Button>
          </div>
        </header>
        
        {renderGrader()}

      </div>
    </TooltipProvider>
  )
}
