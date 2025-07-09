
"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { gradeDocument } from "@/ai/flows/grade-document"
import { chatWithDocument } from "@/ai/flows/chat-with-document"
import { useToast } from "@/hooks/use-toast"
import { Loader2, GraduationCap, Sparkles, Bot, User, ChevronDown, Plus, Trash2, FileUp, Info, Home } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput, ChatWithDocumentInput } from "@/ai/types";
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

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
    maxPoints: number;
}

interface GradingResult {
    analysis: GradeDocumentOutput['analysis'];
    overallFeedback: string;
    score: number;
    highlightedAnswer: string;
}

const example = {
    questions: [
        { id: 'q1', text: "Explain the process of photosynthesis.", rubric: "The explanation should be clear, accurate, and mention the roles of sunlight, water, carbon dioxide, chlorophyll, and the production of glucose and oxygen.", keywords: "sunlight, water, carbon dioxide, chlorophyll, glucose, oxygen", maxPoints: 10 },
        { id: 'q2', text: "What is the primary function of the mitochondria in a cell?", rubric: "The answer must state that mitochondria are responsible for generating most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.", keywords: "ATP, energy, powerhouse, cellular respiration", maxPoints: 5 }
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

// Custom hook for state with localStorage persistence
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const storedValue = window.localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error("Error reading from localStorage", error);
            return defaultValue;
        }
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.setItem(key, JSON.stringify(state));
            } catch (error) {
                console.error("Error writing to localStorage", error);
            }
        }
    }, [key, state]);

    return [state, setState];
}


export default function GraderClient({ assignmentId }: { assignmentId: string }) {
  const [isGrading, setIsGrading] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [isScorePopoverOpen, setIsScorePopoverOpen] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  
  const [assignmentName, setAssignmentName] = usePersistentState(`${assignmentId}-name`, "Untitled Assignment");
  const [questions, setQuestions] = usePersistentState<Question[]>(`${assignmentId}-questions`, []);
  const [students, setStudents] = usePersistentState<Student[]>(`${assignmentId}-students`, []);
  const [gradingResults, setGradingResults] = usePersistentState<Record<string, Record<string, GradingResult>>>(`${assignmentId}-results`, {}); // [questionId][studentId]
  const [chatHistory, setChatHistory] = usePersistentState<ChatMessage[]>(`${assignmentId}-chat`, []);
  
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);

  // State for the new data dialog
  const [studentCount, setStudentCount] = useState(2);
  const [pastedText, setPastedText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast()

  const currentQuestion = questions[activeQuestionIndex];
  const currentGradingResult = useMemo(() => {
    if (!currentQuestion || !activeStudentId) return null;
    return gradingResults[currentQuestion.id]?.[activeStudentId] ?? null;
  }, [gradingResults, currentQuestion, activeStudentId]);

  useEffect(() => {
    if (students.length > 0 && (!activeStudentId || !students.find(s => s.id === activeStudentId))) {
        setActiveStudentId(students[0]?.id ?? null);
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
    setIsDataDialogOpen(false);
    toast({ title: "Example Data Loaded", description: "You can now start grading." });
  };
  
  const handleAddNewQuestion = () => {
    const newQuestion: Question = {
      id: `q${Date.now()}`,
      text: "New Question",
      rubric: "",
      keywords: "",
      maxPoints: 10,
    };
    setQuestions(prev => [...prev, newQuestion]);
  };

  const handleUpdateQuestion = (index: number, field: keyof Question, value: string | number) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      newQuestions[index] = { ...newQuestions[index], [field]: value };
      return newQuestions;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    // Also remove corresponding answers from students
    setStudents(prev => prev.map(student => {
        const newAnswers = [...student.answers];
        newAnswers.splice(index, 1);
        return { ...student, answers: newAnswers };
    }));
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
        const regex = new RegExp(`(^|\\s|>)(${escapedSegment})(<|\\s|$)`, 'gi');

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

  const handleManualScoreChange = (newScore: number) => {
    if (!currentQuestion || !activeStudentId || !currentGradingResult) return;

    setGradingResults(prev => ({
        ...prev,
        [currentQuestion.id]: {
            ...prev[currentQuestion.id],
            [activeStudentId]: {
                ...currentGradingResult,
                score: newScore,
            }
        }
    }));
  };
  
  const handleGrade = async () => {
    if (questions.length === 0 || students.length === 0) {
        toast({ title: "Missing Data", description: "Please add questions and students first.", variant: "destructive" });
        return;
    }
    setIsGrading(true);
    setGradingResults({}); // Clear previous results
    setChatHistory([]); // Clear chat history on new grade
    toast({ title: "Grading Started", description: "Analyzing all student answers..." });
    try {
        for (const question of questions) {
            for (const student of students) {
                const answerIndex = questions.findIndex(q => q.id === question.id);
                if (answerIndex === -1 || !student.answers[answerIndex]) {
                  console.warn(`Skipping grading for ${student.name} on question "${question.text}" due to missing answer.`);
                  continue;
                }
                const gradeInput: GradeDocumentInput = {
                    question: question.text,
                    answer: student.answers[answerIndex],
                    rubric: `${question.rubric} Grading is out of ${question.maxPoints} points.`,
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
                rubric: `${currentQuestion.rubric} Grading is out of ${currentQuestion.maxPoints} points.`,
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        setUploadedFiles(Array.from(event.target.files));
        setValidationWarning(null);
    }
  };
  
  const parseAndSetStudents = async () => {
    let parsedStudents: Student[] = [];
    let detectedCount = 0;

    const activeTab = document.querySelector('[data-state="active"]')?.getAttribute('data-value');

    if (activeTab === 'paste-text') {
        // More flexible regex to find "Student <Name/ID>" followed by a colon or space
        const studentBlocks = pastedText.split(/Student\s(?:Name\s)?([A-Za-z0-9]+)[:\s]*/i).filter(s => s.trim());
        
        let names: string[] = [];
        let answersBlocks: string[] = [];

        // The regex split results in an array of [name, answers, name, answers, ...]
        for (let i = 0; i < studentBlocks.length; i += 2) {
            names.push(studentBlocks[i].trim() || `Student ${names.length + 1}`);
            answersBlocks.push(studentBlocks[i + 1] ? studentBlocks[i + 1].trim() : "");
        }

        detectedCount = names.length;

        parsedStudents = names.map((name, index) => {
            const answerText = answersBlocks[index] || "";
            let answers: string[] = [];

            // If there's more than one question, attempt to split the answer block
            if (questions.length > 1 && answerText) {
                // Heuristic: try splitting by bullet points first
                let potentialAnswers = answerText.split(/•/g).map(a => a.trim()).filter(Boolean);
                
                // If not bullet points, try splitting by double newlines
                if (potentialAnswers.length < questions.length) {
                    potentialAnswers = answerText.split(/\n\s*\n/).map(a => a.trim()).filter(Boolean);
                }

                // If still not enough, chunk the text as a last resort
                if (potentialAnswers.length < questions.length) {
                     const words = answerText.split(/\s+/);
                     const wordsPerAnswer = Math.max(1, Math.floor(words.length / questions.length));
                     potentialAnswers = [];
                     for (let i = 0; i < questions.length; i++) {
                        const start = i * wordsPerAnswer;
                        const end = (i === questions.length - 1) ? words.length : (i + 1) * wordsPerAnswer;
                        potentialAnswers.push(words.slice(start, end).join(' '));
                     }
                }
                answers = potentialAnswers.slice(0, questions.length);

            } else {
                 answers = [answerText];
            }

            return { id: `s${Date.now()}${index}`, name, answers };
        });
        
    } else { // File Upload
        detectedCount = uploadedFiles.length;
        const studentPromises = uploadedFiles.map(async (file, index) => {
            const text = await file.text();
            // Assuming each line in file is an answer
            const answers = text.split('\n').map(line => line.trim()).filter(Boolean);
            const name = file.name.replace(/\.[^/.]+$/, "") || `Student ${index + 1}`; // filename without extension
            return { id: `s${Date.now()}${index}`, name, answers };
        });
        parsedStudents = await Promise.all(studentPromises);
    }

    if (detectedCount < studentCount) {
        setValidationWarning(`Only ${detectedCount} out of ${studentCount} student answers provided.`);
        setStudents(parsedStudents); // Set what we have, so user can choose to continue
        return; // Stop here and wait for user action
    }

    setStudents(parsedStudents);
    setIsDataDialogOpen(false);
    setValidationWarning(null);
    toast({title: "Student Data Updated", description: `${parsedStudents.length} students loaded.`});
  };

  const handleContinueAnyway = () => {
    setIsDataDialogOpen(false);
    setValidationWarning(null);
    toast({title: "Student Data Updated", description: `${students.length} students loaded.`});
  }

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
                            {isDataLoaded ? 'Click "Start Grading" to see results.' : 'Add data to begin.'}
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
                        <DropdownMenuTrigger asChild disabled={!isDataLoaded}>
                            <Button variant="outline">
                                {currentQuestion ? `Q${activeQuestionIndex + 1}: ${currentQuestion.text.substring(0, 30)}...` : 'No Questions'}
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
                        <Popover open={isScorePopoverOpen} onOpenChange={setIsScorePopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="text-2xl font-bold text-primary flex items-center gap-2">
                                    <Sparkles className="w-6 h-6" />
                                    <span>{currentGradingResult.score} / {currentQuestion.maxPoints}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Override Score</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Manually adjust the grade for this answer.
                                        </p>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="score-override">Score</Label>
                                        <Input
                                            id="score-override"
                                            type="number"
                                            defaultValue={currentGradingResult.score}
                                            onChange={(e) => handleManualScoreChange(parseFloat(e.target.value) || 0)}
                                            max={currentQuestion.maxPoints}
                                            min={0}
                                        />
                                    </div>
                                    <Button onClick={() => setIsScorePopoverOpen(false)}>Done</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </CardHeader>
            </Card>
            <Card className="flex-grow">
                <CardContent className="p-0 h-full">
                    {!isDataLoaded ? (
                         <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <GraduationCap className="w-16 h-16 mb-4"/>
                            <h2 className="text-xl font-semibold">Grade Documents</h2>
                            <p className="text-sm">Click the plus icon to add data.</p>
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
                                     <ScrollArea className="h-full">
                                        <div className="p-4 font-body prose whitespace-pre-wrap">
                                            {s.answers[activeQuestionIndex] ?? "No answer provided for this question."}
                                        </div>
                                    </ScrollArea>
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
  
  const renderDataDialog = () => (
    <Dialog open={isDataDialogOpen} onOpenChange={(open) => { setIsDataDialogOpen(open); if (!open) setValidationWarning(null); }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Manage Data</DialogTitle>
                <CardDescription>Add questions and student answers here.</CardDescription>
            </DialogHeader>
            <Tabs defaultValue="questions" className="flex-grow flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
                    <TabsTrigger value="answers">Student Answers ({students.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="questions" className="flex-grow overflow-auto">
                    <ScrollArea className="h-full pr-4">
                        <Accordion type="multiple" className="w-full">
                            {questions.map((q, index) => (
                                <AccordionItem value={q.id} key={q.id}>
                                    <AccordionTrigger>
                                        <span className="truncate flex-1 text-left">Question {index + 1}: {q.text || "New Question"}</span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4 p-2">
                                            <div className="space-y-2">
                                                <Label htmlFor={`q-text-${q.id}`}>Question Text</Label>
                                                <Textarea id={`q-text-${q.id}`} value={q.text} onChange={e => handleUpdateQuestion(index, 'text', e.target.value)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`q-rubric-${q.id}`}>Rubric</Label>
                                                <Textarea id={`q-rubric-${q.id}`} value={q.rubric} onChange={e => handleUpdateQuestion(index, 'rubric', e.target.value)} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`q-keywords-${q.id}`}>Keywords (comma-separated)</Label>
                                                    <Input id={`q-keywords-${q.id}`} value={q.keywords} onChange={e => handleUpdateQuestion(index, 'keywords', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`q-maxPoints-${q.id}`}>Max Points</Label>
                                                    <Input id={`q-maxPoints-${q.id}`} type="number" value={q.maxPoints} onChange={e => handleUpdateQuestion(index, 'maxPoints', parseInt(e.target.value, 10) || 0)} />
                                                </div>
                                            </div>
                                            <Button variant="destructive" size="sm" onClick={() => handleRemoveQuestion(index)}><Trash2 className="mr-2"/> Remove Question</Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                        <Button onClick={handleAddNewQuestion} className="mt-4"><Plus className="mr-2"/> Add Question</Button>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="answers" className="flex-grow flex flex-col overflow-auto p-1">
                     <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                            <Label htmlFor="student-count">Total number of students</Label>
                            <Input id="student-count" type="number" value={studentCount} onChange={e => setStudentCount(parseInt(e.target.value, 10) || 0)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="question-count">Total number of questions per student</Label>
                            <Input id="question-count" type="number" value={questions.length} disabled />
                            <p className="text-xs text-muted-foreground">Syncs with the number of questions added.</p>
                        </div>
                     </div>
                     <Tabs defaultValue="paste-text" className="flex-grow flex flex-col">
                        <TabsList className="grid w-full grid-cols-2">
                           <TabsTrigger value="paste-text">Paste Text</TabsTrigger>
                           <TabsTrigger value="file-upload">File Upload</TabsTrigger>
                        </TabsList>
                        <TabsContent value="paste-text" className="flex-grow flex flex-col">
                            <Card className="mt-2">
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base flex items-center gap-2">Formatting Guide 
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Info className="w-4 h-4 text-muted-foreground cursor-pointer"/>
                                            </PopoverTrigger>
                                            <PopoverContent>
                                                <div className="p-2 text-sm space-y-2">
                                                    <p className="font-bold">Each student's entry starts with "Student" and a name/ID, followed by their answers. The parser will attempt to divide the text among the questions.</p>
                                                    <code className="block whitespace-pre-wrap p-2 rounded bg-muted mt-2 text-xs">
                                                        Student A:<br/>
                                                        Answer to Question 1...<br/>
                                                        Answer to Question 2...<br/>
                                                        <br/>
                                                        Student Name Bob<br/>
                                                        Answer 1...<br/>
                                                    </code>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </CardTitle>
                                </CardHeader>
                            </Card>
                            <Textarea 
                                className="flex-grow mt-2" 
                                placeholder="Paste all student answers here..."
                                value={pastedText}
                                onChange={e => {setPastedText(e.target.value); setValidationWarning(null);}}
                            />
                        </TabsContent>
                        <TabsContent value="file-upload" className="flex-grow flex flex-col">
                            <Card className="mt-2">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">Formatting Guide
                                      <Popover>
                                          <PopoverTrigger asChild>
                                            <Info className="w-4 h-4 text-muted-foreground cursor-pointer"/>
                                          </PopoverTrigger>
                                          <PopoverContent>
                                              <p className="max-w-xs p-2 text-sm">Upload one .txt file per student. The student's name will be the filename. Each line in the file is treated as an answer to a question, in order.</p>
                                          </PopoverContent>
                                      </Popover>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                        <FileUp className="mr-2" />
                                        Upload Files ({uploadedFiles.length})
                                    </Button>
                                    <Input 
                                        type="file" 
                                        multiple 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={handleFileChange}
                                        accept=".txt"
                                    />
                                    <ScrollArea className="mt-2 h-32 w-full rounded-md border p-2">
                                        {uploadedFiles.length > 0 ? (
                                            <ul>
                                                {uploadedFiles.map((file, i) => <li key={i} className="text-sm">{file.name}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-10">No files uploaded.</p>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                     </Tabs>
                </TabsContent>
            </Tabs>
             {validationWarning && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                        {validationWarning}
                        <div className="flex gap-2 mt-2">
                           <Button variant="outline" size="sm" onClick={() => setValidationWarning(null)}>Go Back and Fix</Button>
                           <Button size="sm" onClick={handleContinueAnyway}>Continue Anyway</Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
            <DialogFooter className="pt-4">
                <Button variant="outline" onClick={loadExample}>Load Example Data</Button>
                <Button onClick={validationWarning ? undefined : parseAndSetStudents} disabled={!!validationWarning}>
                  {validationWarning ? 'Resolve Warning' : 'Update Student Answers'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b border-border print:hidden shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/" passHref>
                <Button variant="outline" size="icon">
                    <Home />
                    <span className="sr-only">Home</span>
                </Button>
            </Link>
            <h1 className="text-xl font-headline font-bold text-gray-800">
              {assignmentName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" onClick={() => setIsDataDialogOpen(true)}>
                <Plus />
                <span className="sr-only">Add or manage data</span>
            </Button>
            <Button onClick={handleGrade} disabled={isGrading || !isDataLoaded}>
                {isGrading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {isGrading ? "Grading..." : <><GraduationCap className="mr-2"/> Start Grading</>}
            </Button>
          </div>
        </header>
        
        {renderGrader()}
        {renderDataDialog()}

      </div>
    </TooltipProvider>
  )
}
