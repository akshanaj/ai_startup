"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const createNewAssignment = () => {
    // In a real app, this would create a record in a database.
    // For now, we'll just generate a unique ID for the route.
    const newAssignmentId = `asg-${Date.now()}`;
    router.push(`/assignment/${newAssignmentId}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-24">
      <div className="text-center">
        <h1 className="text-5xl font-bold font-headline mb-4">
          Welcome to Teacher&apos;s Pet
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Your AI-powered grading assistant.
        </p>
        <Button size="lg" onClick={createNewAssignment}>
          <PlusCircle className="mr-2" />
          New Assignment
        </Button>
      </div>
    </main>
  );
}
