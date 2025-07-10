"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, BookOpen, Apple } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';

interface Assignment {
  id: string;
  name: string;
}

export default function Home() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const savedAssignments: Assignment[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith('-name')) {
          const id = key.replace('-name', '');
          // Ensure it's an assignment key
          if (id.startsWith('asg-')) {
            const name = localStorage.getItem(key);
            if (name) {
              savedAssignments.push({ id, name: JSON.parse(name) });
            }
          }
        }
      }
      setAssignments(savedAssignments.sort((a, b) => {
        const aTime = parseInt(a.id.split('-')[1]);
        const bTime = parseInt(b.id.split('-')[1]);
        return bTime - aTime; // Sort by most recent
      }));
    }
  }, [isClient]);

  const createNewAssignment = () => {
    const newAssignmentId = `asg-${Date.now()}`;
    router.push(`/assignment/${newAssignmentId}`);
  };

  const deleteAssignment = (assignmentId: string) => {
    // Remove all keys associated with this assignment
    Object.keys(localStorage)
      .filter(key => key.startsWith(assignmentId))
      .forEach(key => localStorage.removeItem(key));
    
    // Update state to reflect deletion
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
  };

  return (
    <main className="flex min-h-screen flex-col items-center bg-transparent p-8 sm:p-12 md:p-24">
      <div className="w-full max-w-4xl rounded-xl border border-border/20 bg-background/80 p-8 shadow-2xl backdrop-blur-sm">
        <div className="text-center mb-12 p-8 rounded-xl bg-gradient-to-b from-muted/30 to-background/10">
           <div className="flex items-center justify-center gap-4 mb-4">
              <Apple className="w-12 h-12 text-destructive transition-transform duration-300 hover:animate-pulse" />
              <h1 className="text-5xl font-bold font-headline">
                 Welcome to <span className="px-2 py-1 rounded-md bg-green-200/50">Teacher&apos;s</span> <span className="px-2 py-1 rounded-md bg-red-200/50">Pet</span>
              </h1>
            </div>
          <p className="text-lg text-muted-foreground mb-8 font-body">
            Your AI-powered grading assistant.
          </p>
          <Button size="lg" onClick={createNewAssignment} className="font-semibold shadow-sm rounded-lg hover:bg-primary/90">
            <PlusCircle className="mr-2" />
            New Assignment
          </Button>
        </div>

        {isClient && assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors shadow-md">
                    <Link href={`/assignment/${assignment.id}`} className="flex-grow">
                      <div className="flex items-center gap-4">
                        <BookOpen className="w-6 h-6 text-primary" />
                        <div>
                          <p className="font-semibold">{assignment.name}</p>
                          <p className="text-sm text-gray-500">ID: {assignment.id}</p>
                        </div>
                      </div>
                    </Link>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-5 h-5" />
                            <span className="sr-only">Delete Assignment</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the assignment
                             and all related data from your local storage.
                          </Description>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteAssignment(assignment.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}