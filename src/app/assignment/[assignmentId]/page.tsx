import GraderClient from '@/components/grader-client';

export default function AssignmentPage({ params }: { params: { assignmentId: string } }) {
  // You can use the assignmentId to fetch specific assignment data in the future
  return <GraderClient assignmentId={params.assignmentId} />;
}
