
"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { gradeDocument } from "@/ai/flows/grade-document"
import { chatWithDocument } from "@/ai/flows/chat-with-document"
import { useToast } from "@/hooks/use-toast"
import { Loader2, GraduationCap, Sparkles, Bot, User, ChevronDown, Plus, Trash2, Home, Pencil, AlertTriangle, Info, FileText, Upload, ClipboardPaste } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput, ChatWithDocumentInput } from "@/ai/types";
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import Link from "next/link"
import mammoth from "mammoth";
import * as pdfjs from 'pdfjs-dist/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  const [assignmentName, setAssignmentName] = usePersistentState(`${assignmentId}-name`, "Untitled Assignment");
  const [questions, setQuestions] = usePersistentState<Question[]>(`${assignmentId}-questions`, []);
  const [students, setStudents] = usePersistentState<Student[]>(`${assignmentId}-students`, []);
  const [gradingResults, setGradingResults] = usePersistentState<Record<string, Record<string, GradingResult>>>(`${assignmentId}-results`, {}); // [questionId][studentId]
  const [chatHistory, setChatHistory] = usePersistentState<ChatMessage[]>(`${assignmentId}-chat`, []);
  
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("");
  const chatScrollAreaRef = useRef<HTMLDivElement>(null);
  const [editableTitle, setEditableTitle] = useState(assignmentName);

  const [activeDataTab, setActiveDataTab] = useState("file-upload");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [validationWarning, setValidationWarning] = useState<{ message: string, onContinue: () => void } | null>(null);
  const [pastedAnswers, setPastedAnswers] = useState("");

  const { toast } = useToast()

  const currentQuestion = questions[activeQuestionIndex];
  const currentGradingResult = useMemo(() => {
    if (!currentQuestion || !activeStudentId) return null;
    return gradingResults[currentQuestion.id]?.[activeStudentId] ?? null;
  }, [gradingResults, currentQuestion, activeStudentId]);
  
  useEffect(() => {
    setEditableTitle(assignmentName)
  }, [assignmentName]);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
        setUploadedFiles(Array.from(event.target.files));
    }
  };

  const parseFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                if (!event.target?.result) {
                    return reject(new Error("File content is empty."));
                }
                const arrayBuffer = event.target.result as ArrayBuffer;

                if (file.type === 'application/pdf') {
                    const pdf = await pdfjs.getDocument(new Uint8Array(arrayBuffer)).promise;
                    let text = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        text += content.items.map((item: any) => item.str).join(' ');
                    }
                    resolve(text);
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve(result.value);
                } else { // Plain text
                    resolve(new TextDecoder().decode(arrayBuffer));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

  const processFilesAndCreateStudents = async (files: File[]): Promise<Student[]> => {
    const newStudents: Student[] = [];
    for (const file of files) {
        try {
            const text = await parseFileContent(file);
            const name = file.name.replace(/\.[^/.]+$/, ""); // Filename without extension
            const answers = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => /^[\s]*[•\-–*]/.test(line))
                .map(line => line.replace(/^[\s]*[•\-–*][\s]*/, ''));

            if (answers.length > 0) {
                newStudents.push({
                    id: `s-${Date.now()}-${name}`,
                    name: name,
                    answers: answers,
                });
            }
        } catch (error) {
            toast({
                title: `Error processing ${file.name}`,
                description: "Could not read or parse the file.",
                variant: "destructive"
            });
            console.error(`Error processing file ${file.name}:`, error);
        }
    }
    return newStudents;
  };

  const sanitizeLine = (line: string): string => {
    // Trim whitespace and remove non-printable characters except for standard whitespace
    return line.trim().replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '');
  };

  const parsePastedText = (text: string): Student[] => {
      const students: Student[] = [];
      let currentStudent: Student | null = null;
      const lines = text.split('\n');
      
      const studentNameRegex = /^[^\s•\-–*].+/;
      const answerRegex = /^[\s]*[•\-–*][\s]*(.*)/;

      for (const rawLine of lines) {
        const line = sanitizeLine(rawLine);
        if (!line) continue;

        const answerMatch = line.match(answerRegex);

        if (answerMatch) {
          if (currentStudent) {
            currentStudent.answers.push(answerMatch[1].trim());
          }
        } else if (studentNameRegex.test(line)) {
          if (currentStudent) {
            if (currentStudent.answers.length > 0) {
              students.push(currentStudent);
            }
          }
          currentStudent = {
            id: `s-${Date.now()}-${line.substring(0, 10).trim()}`,
            name: line,
            answers: [],
          };
        }
      }

      if (currentStudent && currentStudent.answers.length > 0) {
        students.push(currentStudent);
      }
      return students;
  };

  const handleFormatPastedText = () => {
    const parsedStudents = parsePastedText(pastedAnswers);
    if (parsedStudents.length === 0) {
        toast({
            title: "Nothing to Format",
            description: "Could not find any student data in the format provided.",
            variant: "destructive"
        });
        return;
    }
    const formattedText = parsedStudents.map(student => 
        `${student.name}\n${student.answers.map(a => `• ${a}`).join('\n')}`
    ).join('\n\n');
    setPastedAnswers(formattedText);
    toast({
        title: "Text Formatted",
        description: "Your pasted text has been cleaned up."
    });
  };
  
  const handleUpdateStudentAnswers = async () => {
    let newStudents: Student[] = [];

    if (activeDataTab === 'file-upload' && uploadedFiles.length > 0) {
        newStudents = await processFilesAndCreateStudents(uploadedFiles);
    } else if (activeDataTab === 'paste-text' && pastedAnswers.trim().length > 0) {
        newStudents = parsePastedText(pastedAnswers);
    }

    if (newStudents.length === 0) {
        toast({
            title: "No Student Answers Found",
            description: "Please provide student answers via file upload or by pasting text.",
            variant: "destructive"
        });
        return;
    }

    const validationIssues = newStudents
        .map(s => ({ name: s.name, answerCount: s.answers.length }))
        .filter(s => s.answerCount !== questions.length);

    const commitStudents = (studentsToSet: Student[]) => {
        setStudents(studentsToSet);
        toast({ title: "Student Answers Updated", description: `Successfully loaded ${studentsToSet.length} student answer(s).` });
        setValidationWarning(null);
        setIsDataDialogOpen(false);
    };

    if (validationIssues.length > 0 && questions.length > 0) {
        const message = `Some students have a different number of answers than questions (${questions.length}). Issues: ${validationIssues.map(v => `${v.name} (${v.answerCount})`).join(', ')}. Continue anyway?`;
        setValidationWarning({
            message: message,
            onContinue: () => commitStudents(newStudents)
        });
    } else {
        commitStudents(newStudents);
    }
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

        const escapedSegment = item.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&]');
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
  
  const handleTitleSave = () => {
    if (editableTitle.trim()) {
        setAssignmentName(editableTitle.trim());
    } else {
        setEditableTitle(assignmentName); // revert if empty
    }
    setIsEditingTitle(false);
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
                  <CardDescription>Add questions and student answers for the assignment.</CardDescription>
              </DialogHeader>
              <Tabs defaultValue="questions" className="flex-grow flex flex-col overflow-hidden">
                  <TabsList className="shrink-0">
                      <TabsTrigger value="questions">Questions</TabsTrigger>
                      <TabsTrigger value="student-answers">Student Answers</TabsTrigger>
                  </TabsList>
                  <TabsContent value="questions" className="flex-grow overflow-auto pr-4">
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-muted-foreground">Add and configure your assignment questions here.</p>
                        <Button onClick={handleAddNewQuestion}><Plus className="mr-2" /> Add Question</Button>
                      </div>
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
                                          <Button variant="destructive" size="sm" onClick={() => handleRemoveQuestion(index)}><Trash2 className="mr-2" /> Remove Question</Button>
                                      </div>
                                  </AccordionContent>
                              </AccordionItem>
                          ))}
                      </Accordion>
                      
                  </TabsContent>
                   <TabsContent value="student-answers" className="flex-grow flex flex-col overflow-auto">
                        <Tabs value={activeDataTab} onValueChange={setActiveDataTab} className="flex-grow flex flex-col">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file-upload"><Upload className="mr-2" />File Upload</TabsTrigger>
                                <TabsTrigger value="paste-text"><ClipboardPaste className="mr-2" />Paste Text</TabsTrigger>
                            </TabsList>
                            <TabsContent value="file-upload" className="flex-grow overflow-auto mt-4">
                                <div className="space-y-4 p-4 border rounded-md h-full flex flex-col bg-muted/50">
                                    <div className="space-y-2">
                                        <Label htmlFor="file-upload" className="text-base font-semibold">Upload Student Answers</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Upload one .txt, .docx, or .pdf file per student. The filename will be the student's name, and each answer must start with a bullet point (•, -, or *).
                                        </p>
                                        <Input id="file-upload" type="file" multiple accept=".txt,.docx,.pdf" onChange={handleFileChange} className="bg-background" />
                                    </div>
                                    {uploadedFiles.length > 0 && (
                                    <div className="flex-grow">
                                        <p className="text-sm font-medium mb-2">Selected Files:</p>
                                        <ScrollArea className="h-48 bg-background p-2 rounded-md border">
                                            <ul className="space-y-1">
                                                {uploadedFiles.map(file => (
                                                    <li key={file.name} className="flex items-center gap-2 text-sm p-2 bg-muted rounded-md">
                                                        <FileText className="h-4 w-4" />
                                                        <span className="truncate">{file.name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </ScrollArea>
                                    </div>
                                    )}
                                    <Button onClick={handleUpdateStudentAnswers} disabled={uploadedFiles.length === 0} className="mt-auto">
                                        <Upload className="mr-2" /> Load Answers from Files
                                    </Button>
                                </div>
                            </TabsContent>
                            <TabsContent value="paste-text" className="flex-grow flex flex-col overflow-auto mt-4">
                                <div className="space-y-4 p-4 border rounded-md h-full flex flex-col bg-muted/50">
                                    <div className="space-y-2 flex-grow flex flex-col">
                                        <Label htmlFor="paste-area" className="text-base font-semibold">Paste All Student Answers</Label>
                                         <p className="text-xs text-muted-foreground">
                                            Enter a student's name on its own line, then list their answers on new lines, each starting with a bullet (•, -, or *).
                                        </p>
                                        <Textarea 
                                            id="paste-area"
                                            className="flex-grow bg-background font-mono text-xs"
                                            placeholder={'Student Name 1\n• Answer to question 1...\n• Answer to question 2...\n\nStudent Name 2\n• Their answer to question 1...\n• Their answer to question 2...'}
                                            value={pastedAnswers}
                                            onChange={(e) => setPastedAnswers(e.target.value)}
                                        />
                                    </div>
                                     <div className="flex gap-2 mt-auto">
                                        <Button onClick={handleFormatPastedText} variant="outline" className="flex-1">Format Text</Button>
                                        <Button onClick={handleUpdateStudentAnswers} disabled={!pastedAnswers.trim()} className="flex-1">
                                            <ClipboardPaste className="mr-2" /> Load Pasted Answers
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
              </Tabs>
              {validationWarning && (
                <AlertDialog open onOpenChange={() => setValidationWarning(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Validation Warning</AlertDialogTitle>
                      <AlertDialogDescription>{validationWarning.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Go Back & Fix</AlertDialogCancel>
                      <AlertDialogAction onClick={validationWarning.onContinue}>Continue Anyway</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
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
            <div className="flex items-center gap-2">
                {isEditingTitle ? (
                    <Input
                        value={editableTitle}
                        onChange={(e) => setEditableTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTitleSave();
                            if (e.key === 'Escape') setIsEditingTitle(false);
                        }}
                        className="text-xl h-9"
                        autoFocus
                    />
                ) : (
                    <h1 className="text-xl font-headline font-bold text-gray-800 flex items-center gap-2">
                        {assignmentName}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditingTitle(true)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit title</span>
                        </Button>
                    </h1>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsDataDialogOpen(true)}>
                <Plus className="mr-2"/>
                Manage Data
            </Button>
            <Button onClick={loadExample} variant="secondary">Load Example</Button>
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
