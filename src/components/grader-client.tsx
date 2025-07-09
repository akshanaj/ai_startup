"use client"

import { useState } from "react"
import { gradeDocument } from "@/ai/flows/grade-document"
import { useToast } from "@/hooks/use-toast"
import { Loader2, GraduationCap, Sparkles } from "lucide-react"
import type { GradeDocumentInput, GradeDocumentOutput } from "@/ai/types";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

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

export default function GraderClient() {
  const [isGrading, setIsGrading] = useState(false);
  const [isGradeDialogOpen, setIsGradeDialogOpen] = useState(false);
  const [gradedDoc, setGradedDoc] = useState<GradedDoc | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const [gradeInput, setGradeInput] = useState<GradeDocumentInput>({ question: '', answer: '', rubric: '', keywords: '' });

  const { toast } = useToast()

  const loadExample = () => {
    setGradeInput(example);
  };
  
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
            const sentimentClass = {
                positive: "bg-green-200/50 hover:bg-green-300/80",
                negative: "bg-red-200/50 hover:bg-red-300/80",
                neutral: "bg-yellow-200/50 hover:bg-yellow-300/80"
            }[item.sentiment];

            if (sentimentClass !== "bg-yellow-200/50 hover:bg-yellow-300/80'") { // Don't highlight neutral
                highlightedAnswer = highlightedAnswer.replace(item.segment, `<mark id="${item.id}" class="${sentimentClass} p-1 rounded-md cursor-pointer transition-colors">${item.segment}</mark>`);
            }
        });

        setGradedDoc({
            ...gradeInput,
            id: `doc-${Date.now()}`,
            answer: highlightedAnswer,
            analysis: result.analysis,
            overallFeedback: result.overallFeedback,
            score: result.score,
        });
        
    } catch (error) {
        console.error("Grading error:", error);
        toast({ title: "Grading Error", description: "Could not grade the document. Please try again.", variant: "destructive" });
    } finally {
        setIsGrading(false);
        setIsGradeDialogOpen(false);
    }
  };

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
