
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from 'next/link';

interface Assignment {
  id: string;
  name: string;
}

const AppleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
    <path d="M10 2c1 .5 2 2 2 5" />
    <path d="M17 5.23a2.74 2.74 0 0 1 .5-2.23 2.74 2.74 0 0 0-2.5 2.23" />
  </svg>
);


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
    <main className="flex min-h-screen flex-col items-center bg-background p-8 sm:p-12 md:p-24">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12 p-8 rounded-xl bg-gradient-to-b from-muted/30 to-background">
           <div className="flex items-center justify-center gap-4 mb-4">
              <AppleIcon className="w-12 h-12 text-primary" />
              <h1 className="text-5xl font-bold font-headline">
                  Welcome to Teacher&apos;s Pet
              </h1>
            </div>
          <p className="text-lg text-muted-foreground mb-8 font-body">
            Your AI-powered grading assistant.
          </p>
          <Button size="lg" onClick={createNewAssignment} className="font-semibold shadow-sm">
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
                          </AlertDialogDescription>
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
