/**
 * Signal Desk design: a calm, Swiss-informed operations canvas with a navigation rail,
 * horizontal workflow lanes, fine operational rules, sky-blue orientation, and rare coral signals.
 */
import { useMemo, useState, type DragEvent } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Ellipsis,
  FileText,
  Flag,
  FolderKanban,
  GripVertical,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Status = "backlog" | "progress" | "review" | "done";
type View = "board" | "calendar" | "analytics";

type TeamMember = {
  name: string;
  initials: string;
  color: string;
  avatar?: string;
};

type Task = {
  id: string;
  title: string;
  status: Status;
  label: "Design" | "Product" | "Engineering" | "Research";
  priority: "High" | "Medium" | "Low";
  due: string;
  date: number;
  assignees: TeamMember[];
  comments: number;
  attachments: number;
  subtasks: { title: string; done: boolean }[];
  description: string;
  activity: string;
};

const team: TeamMember[] = [
  { name: "Maya Chen", initials: "MC", color: "bg-[#E8F0F4] text-[#385870]" },
  { name: "Elliot Park", initials: "EP", color: "bg-[#BDE6FF] text-[#1A5C82]" },
  { name: "Noah Williams", initials: "NW", color: "bg-[#D8E4EC] text-[#445666]" },
  { name: "Ari Stone", initials: "AS", color: "bg-[#D9EAD8] text-[#426046]" },
  { name: "Priya Rao", initials: "PR", color: "bg-[#F9DDB1] text-[#7D5214]" },
];

const initialTasks: Task[] = [
  {
    id: "T-018",
    title: "Define onboarding moments",
    status: "backlog",
    label: "Product",
    priority: "Medium",
    due: "Oct 18",
    date: 18,
    assignees: [team[0], team[3]],
    comments: 4,
    attachments: 1,
    subtasks: [
      { title: "Audit welcome flow", done: true },
      { title: "Map first-session decisions", done: false },
      { title: "Share copy prompts", done: false },
    ],
    description: "Outline the moments that turn a new workspace into an active team habit. Keep the first session focused on one clear, shared win.",
    activity: "Maya added the initial journey map yesterday.",
  },
  {
    id: "T-021",
    title: "Research calendar workflows",
    status: "backlog",
    label: "Research",
    priority: "Low",
    due: "Oct 21",
    date: 21,
    assignees: [team[4]],
    comments: 2,
    attachments: 2,
    subtasks: [
      { title: "Collect planning patterns", done: true },
      { title: "Review team interviews", done: false },
    ],
    description: "Capture scheduling patterns from teams who plan delivery work across multiple projects.",
    activity: "Priya shared two interview notes this morning.",
  },
  {
    id: "T-014",
    title: "Prototype the task detail sheet",
    status: "progress",
    label: "Design",
    priority: "High",
    due: "Today",
    date: 15,
    assignees: [team[0], team[1]],
    comments: 8,
    attachments: 3,
    subtasks: [
      { title: "Confirm information hierarchy", done: true },
      { title: "Build activity timeline", done: true },
      { title: "Test long task titles", done: false },
    ],
    description: "Create a detail workspace that holds task context without sending people away from the board. The work should remain readable at a glance and expandable on demand.",
    activity: "Elliot moved this to In progress 26 minutes ago.",
  },
  {
    id: "T-023",
    title: "Instrument weekly momentum",
    status: "progress",
    label: "Engineering",
    priority: "Medium",
    due: "Oct 19",
    date: 19,
    assignees: [team[2]],
    comments: 3,
    attachments: 0,
    subtasks: [
      { title: "Define completion event", done: true },
      { title: "Build team rollup", done: false },
    ],
    description: "Create lightweight reporting that shows whether work is actually moving through the system.",
    activity: "Noah linked a rollout note 2 hours ago.",
  },
  {
    id: "T-010",
    title: "Review sprint handoff",
    status: "review",
    label: "Product",
    priority: "High",
    due: "Today",
    date: 15,
    assignees: [team[1], team[3]],
    comments: 6,
    attachments: 2,
    subtasks: [
      { title: "Compare release criteria", done: true },
      { title: "Resolve open dependency", done: false },
    ],
    description: "Check the product and engineering handoff against agreed delivery criteria before the work is closed.",
    activity: "Ari requested a final review 42 minutes ago.",
  },
  {
    id: "T-006",
    title: "Publish project brief",
    status: "done",
    label: "Design",
    priority: "Low",
    due: "Oct 12",
    date: 12,
    assignees: [team[0]],
    comments: 5,
    attachments: 1,
    subtasks: [
      { title: "Verify project framing", done: true },
      { title: "Share in workspace", done: true },
    ],
    description: "A concise single-page project brief with scope, decisions, and the next milestone.",
    activity: "Maya completed this last Friday.",
  },
];

const columns: { id: Status; title: string; subtitle: string; dot: string }[] = [
  { id: "backlog", title: "Up next", subtitle: "Shape the work", dot: "bg-slate-400" },
  { id: "progress", title: "In progress", subtitle: "Moving now", dot: "bg-[#38A9F2]" },
  { id: "review", title: "In review", subtitle: "Needs a decision", dot: "bg-[#FF6B5E]" },
  { id: "done", title: "Complete", subtitle: "Closed this cycle", dot: "bg-[#6EBB92]" },
];

const navItems = [
  { name: "Overview", icon: LayoutDashboard, view: "board" as View },
  { name: "My tasks", icon: ListChecks, view: "board" as View },
  { name: "Calendar", icon: CalendarDays, view: "calendar" as View },
  { name: "Insights", icon: TrendingUp, view: "analytics" as View },
];

const priorityClass = {
  High: "bg-[#FFF0EE] text-[#D44A3F] ring-[#FFD3CE]",
  Medium: "bg-[#FFF8E6] text-[#A36A00] ring-[#F5DCA0]",
  Low: "bg-[#F0F5F7] text-[#597080] ring-[#DDE8ED]",
};

function TeamFaces({ members, compact = false }: { members: TeamMember[]; compact?: boolean }) {
  return (
    <div className="flex -space-x-2">
      {members.map((member) => (
        <Avatar
          key={member.name}
          className={cn(
            "border-2 border-white shadow-sm",
            compact ? "h-5 w-5 text-[7px]" : "h-7 w-7 text-[9px]",
          )}
        >
          {member.avatar && <AvatarImage src={member.avatar} alt={member.name} />}
          <AvatarFallback className={cn("font-extrabold", member.color)}>{member.initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

function TaskCard({ task, onOpen, onDragStart }: { task: Task; onOpen: () => void; onDragStart: (event: DragEvent<HTMLButtonElement>) => void }) {
  const complete = task.subtasks.filter((subtask) => subtask.done).length;
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="task-card group w-full rounded-xl border border-[#E5EDF2] border-l-[3px] border-l-[#D6E7EF] bg-white p-3.5 text-left shadow-[0_2px_8px_rgba(21,54,74,0.025)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#BEDFF1] hover:border-l-[#38A9F2] hover:shadow-[0_10px_22px_rgba(21,54,74,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38A9F2]"
      aria-label={`Open task ${task.title}`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge variant="outline" className="h-5 rounded-md border-0 bg-[#EEF6FB] px-1.5 text-[10px] font-bold text-[#31779F]">
          {task.label}
        </Badge>
        <GripVertical className="h-3.5 w-3.5 text-[#B7C5CE] opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <h3 className="min-h-10 pr-1 text-[13px] font-extrabold leading-5 tracking-[-0.01em] text-[#172B4D]">{task.title}</h3>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset", priorityClass[task.priority])}>{task.priority}</span>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", task.due === "Today" ? "text-[#E4574C]" : "text-[#718491]") }>
          <Clock3 className="h-3 w-3" />
          {task.due}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#EDF2F5] pt-3">
        <TeamFaces members={task.assignees} compact />
        <div className="flex items-center gap-2.5 text-[#7C8E9B]">
          {task.attachments > 0 && <span className="flex items-center gap-0.5 text-[10px] font-semibold"><Paperclip className="h-3 w-3" />{task.attachments}</span>}
          <span className="flex items-center gap-0.5 text-[10px] font-semibold"><MessageCircle className="h-3 w-3" />{task.comments}</span>
          <span className="flex items-center gap-0.5 text-[10px] font-semibold"><CheckCircle2 className="h-3 w-3" />{complete}/{task.subtasks.length}</span>
        </div>
      </div>
    </button>
  );
}

function MetricCard({ label, value, delta, icon: Icon, accent }: { label: string; value: string; delta: string; icon: typeof Target; accent: string }) {
  return (
    <div className="relative min-h-[73px] overflow-hidden bg-white px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#8093A0]">{label}</p>
          <p className="mt-1 font-['DM_Serif_Display'] text-2xl text-[#172B4D]">{value}</p>
        </div>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", accent)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-1.5 text-[10px] font-bold text-[#73907F]">{delta}</p>
    </div>
  );
}

function BoardView({ tasks, openTask, onDragStart, onDrop }: { tasks: Task[]; openTask: (id: string) => void; onDragStart: (event: DragEvent<HTMLButtonElement>, id: string) => void; onDrop: (event: DragEvent<HTMLDivElement>, status: Status) => void }) {
  return (
    <div className="board-scroll min-w-[920px] flex-1 overflow-x-auto px-5 pb-6 pt-2 lg:px-7">
      <div className="grid min-w-[920px] grid-cols-4 gap-4">
        {columns.map((column) => {
          const items = tasks.filter((task) => task.status === column.id);
          return (
            <div
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, column.id)}
              className="kanban-lane min-h-[545px] rounded-xl border-t border-[#DDE9EF] bg-[#F2F7FA] p-2.5"
            >
              <div className="mb-3 flex items-start justify-between px-1.5 pt-1">
                <div>
                  <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", column.dot)} /><h2 className="text-[13px] font-extrabold text-[#253B56]">{column.title}</h2><span className="text-[11px] font-bold text-[#8AA0AF]">{items.length}</span></div>
                  <p className="mt-0.5 text-[10px] font-medium text-[#8B9EAA]">{column.subtitle}</p>
                </div>
                <button onClick={() => toast("Column options are ready for your workflow.")} className="rounded-md p-1 text-[#91A4B0] hover:bg-white hover:text-[#39516A]" aria-label={`${column.title} options`}><MoreHorizontal className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2.5">
                {items.map((task) => <TaskCard key={task.id} task={task} onOpen={() => openTask(task.id)} onDragStart={(event) => onDragStart(event, task.id)} />)}
              </div>
              <button onClick={() => toast(`A new task will be added to ${column.title}.`)} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-[#7C929F] transition-colors hover:bg-white hover:text-[#2778A9]"><Plus className="h-3.5 w-3.5" />Add task</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarView({ tasks, openTask }: { tasks: Task[]; openTask: (id: string) => void }) {
  const days = Array.from({ length: 35 }, (_, index) => index - 1);
  const taskByDate = (date: number) => tasks.filter((task) => task.date === date);
  return (
    <div className="flex flex-1 flex-col overflow-auto px-5 pb-6 pt-2 lg:px-7">
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#172B4D]">October 2026</h2><p className="text-[11px] font-medium text-[#7D919F]">Deadlines and team milestones in one view.</p></div>
        <div className="flex items-center gap-1"><Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#DFEAF0] bg-white"><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-[#DFEAF0] bg-white"><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-[#E2EBF0] bg-white shadow-[0_8px_28px_rgba(27,73,96,0.055)]">
        <div className="grid grid-cols-7 border-b border-[#E8EFF3] bg-[#FAFCFD]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="px-3 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8296A4]">{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            const isCurrent = date > 0 && date <= 31;
            const dayTasks = isCurrent ? taskByDate(date) : [];
            return <div key={index} className={cn("min-h-25 border-b border-r border-[#E8EFF3] p-2.5", !isCurrent && "bg-[#FBFCFD]")}>
              {isCurrent && <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold", date === 15 ? "bg-[#172B4D] text-white" : "text-[#526B7B]")}>{date}</span>}
              <div className="mt-1.5 space-y-1">
                {dayTasks.map((task) => <button key={task.id} onClick={() => openTask(task.id)} className={cn("block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-extrabold", task.priority === "High" ? "bg-[#FFF0EE] text-[#CD5148]" : "bg-[#EAF6FF] text-[#2776A5]")}>{task.title}</button>)}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((task) => task.status === "done").length;
  const inFlight = tasks.filter((task) => task.status === "progress" || task.status === "review").length;
  return (
    <div className="flex flex-1 flex-col overflow-auto px-5 pb-6 pt-2 lg:px-7">
      <div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#172B4D]">Momentum, not meetings.</h2><p className="text-[11px] font-medium text-[#7D919F]">A focused read on how your work moved this week.</p></div><Button variant="outline" className="h-8 rounded-lg border-[#DCE8EE] bg-white text-[11px] font-bold text-[#3D5870]"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />This week <ChevronDown className="ml-1.5 h-3.5 w-3.5" /></Button></div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.85fr]">
        <section className="overflow-hidden rounded-[24px] border border-[#E5EDF2] bg-white shadow-[0_8px_30px_rgba(27,73,96,0.055)]">
          <div className="flex items-start justify-between p-5 pb-0"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8296A4]">Completed work</p><p className="mt-1 font-['DM_Serif_Display'] text-4xl text-[#172B4D]">{done + 18}</p><p className="mt-1 text-[11px] font-bold text-[#6E9B7F]"><ArrowUpRight className="mr-0.5 inline h-3.5 w-3.5" />12% over last week</p></div><Badge className="rounded-lg bg-[#EAF6FF] text-[10px] font-bold text-[#2677A7] hover:bg-[#EAF6FF]">Delivery pace</Badge></div>
          <div className="relative mt-3 h-50 px-5 pb-5">
            <svg viewBox="0 0 650 190" className="h-full w-full overflow-visible" aria-label="Weekly completed work chart">
              <defs><linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38A9F2" stopOpacity="0.2" /><stop offset="100%" stopColor="#38A9F2" stopOpacity="0" /></linearGradient></defs>
              {[35, 80, 125, 170].map((y) => <line key={y} x1="0" x2="650" y1={y} y2={y} stroke="#EAF0F4" strokeDasharray="4 5" />)}
              <path d="M 0 153 C 40 145, 57 117, 93 122 S 156 142, 184 99 S 244 82, 278 101 S 339 86, 370 62 S 425 89, 463 49 S 541 70, 570 36 S 617 39, 650 18 L 650 190 L 0 190 Z" fill="url(#areaGradient)" />
              <path d="M 0 153 C 40 145, 57 117, 93 122 S 156 142, 184 99 S 244 82, 278 101 S 339 86, 370 62 S 425 89, 463 49 S 541 70, 570 36 S 617 39, 650 18" fill="none" stroke="#38A9F2" strokeWidth="4" strokeLinecap="round" />
              <circle cx="570" cy="36" r="6" fill="#FF6B5E" stroke="white" strokeWidth="4" />
            </svg>
            <div className="absolute bottom-1 left-5 right-5 flex justify-between text-[9px] font-bold uppercase tracking-[0.1em] text-[#91A3AE]"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
        </section>
        <section className="relative min-h-70 overflow-hidden rounded-[24px] border border-[#DDEBF2] bg-[#EEF8FC] p-5 shadow-[0_8px_30px_rgba(27,73,96,0.055)]">
          <img src="/manus-storage/tasknest-collaboration-orbit_543d97e9.png" alt="Abstract collaboration orbit" className="absolute -right-15 -bottom-18 w-75 mix-blend-multiply opacity-90" />
          <div className="relative z-10 max-w-44"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#2778A9] shadow-sm"><UsersRound className="h-4 w-4" /></span><p className="mt-4 font-['DM_Serif_Display'] text-2xl leading-7 text-[#172B4D]">Your team cleared the noise.</p><p className="mt-2 text-[11px] font-semibold leading-5 text-[#66808F]">78% of active work has a named next action.</p></div>
        </section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_0.85fr]">
        <section className="rounded-[22px] border border-[#E5EDF2] bg-white p-5 shadow-[0_4px_18px_rgba(27,73,96,0.04)]"><div className="flex items-center justify-between"><h3 className="text-[13px] font-extrabold text-[#263E56]">Workflow balance</h3><Ellipsis className="h-4 w-4 text-[#8A9CA7]" /></div><div className="mt-5 space-y-4">{columns.slice(0, 3).map((column, index) => <div key={column.id}><div className="mb-1.5 flex justify-between text-[10px] font-bold text-[#718491]"><span>{column.title}</span><span>{[22, 52, 26][index]}%</span></div><Progress value={[22, 52, 26][index]} className="h-1.5 bg-[#EDF3F6] [&>div]:bg-[#38A9F2]" /></div>)}</div></section>
        <section className="rounded-[22px] border border-[#E5EDF2] bg-white p-5 shadow-[0_4px_18px_rgba(27,73,96,0.04)]"><div className="flex items-center justify-between"><h3 className="text-[13px] font-extrabold text-[#263E56]">Team rhythm</h3><span className="text-[10px] font-bold text-[#6E9B7F]">Healthy</span></div><div className="mt-4 space-y-3">{team.slice(0, 3).map((member, index) => <div key={member.name} className="flex items-center gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className={cn("text-[9px] font-extrabold", member.color)}>{member.initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex justify-between text-[10px] font-bold text-[#40576B]"><span>{member.name}</span><span>{[86, 74, 68][index]}%</span></div><Progress value={[86, 74, 68][index]} className="mt-1 h-1 bg-[#EDF3F6] [&>div]:bg-[#67B9E7]" /></div></div>)}</div></section>
        <section className="overflow-hidden rounded-[22px] border border-[#FFE0DB] bg-[#FFF7F5] p-5 shadow-[0_4px_18px_rgba(27,73,96,0.04)]"><Flag className="h-4 w-4 text-[#FF6B5E]" /><p className="mt-3 text-[13px] font-extrabold leading-5 text-[#763C35]">{inFlight} items need a decision before Friday.</p><button onClick={() => toast("Decision queue opened.")} className="mt-3 text-[11px] font-extrabold text-[#D14E44] underline decoration-[#F2B7B0] underline-offset-4">Review priority work</button></section>
      </div>
    </div>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<View>("board");
  const [comment, setComment] = useState("");
  const [project, setProject] = useState("Nimble launch");

  const activeTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) ?? null, [tasks, selectedTaskId]);
  const handleDrop = (event: DragEvent<HTMLDivElement>, nextStatus: Status) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId) return;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: nextStatus } : task));
    toast.success(`Task moved to ${columns.find((column) => column.id === nextStatus)?.title}.`);
  };

  const handleToggleSubtask = (index: number) => {
    if (!activeTask) return;
    setTasks((current) => current.map((task) => task.id === activeTask.id ? { ...task, subtasks: task.subtasks.map((subtask, taskIndex) => taskIndex === index ? { ...subtask, done: !subtask.done } : subtask) } : task));
  };

  const handleComment = () => {
    if (!activeTask || !comment.trim()) return;
    setTasks((current) => current.map((task) => task.id === activeTask.id ? { ...task, comments: task.comments + 1, activity: `You left a note just now: “${comment.trim()}”` } : task));
    setComment("");
    toast.success("Your note is now part of the task context.");
  };

  const selectProject = (projectName: string) => {
    setProject(projectName);
    toast(`${projectName} is now in focus.`);
  };

  return (
    <main className="min-h-screen bg-[#F7FAFB] text-[#172B4D]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[238px] shrink-0 flex-col border-r border-[#DFE9EE] bg-white px-4 py-5 lg:flex">
          <div className="flex items-center gap-2.5 px-2"><img src="/manus-storage/tasknest-mark_1fcfb7d8.png" alt="TaskNest" className="h-9 w-9" /><div><span className="block text-[17px] font-extrabold tracking-[-0.05em] text-[#172B4D]">TaskNest</span><span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[#8498A5]">Team workspace</span></div></div>
          <button onClick={() => toast("Search is ready for your team’s projects and tasks.")} className="mt-7 flex h-9 w-full items-center gap-2 rounded-xl border border-[#E1EBF0] bg-[#F9FBFC] px-3 text-left text-[11px] font-semibold text-[#8A9BA7] transition-colors hover:bg-[#F2F8FB] hover:text-[#527084]"><Search className="h-3.5 w-3.5" /><span className="flex-1">Search work</span><kbd className="rounded border border-[#DCE7EC] bg-white px-1 text-[9px] font-bold text-[#9BAAB3]">⌘ K</kbd></button>
          <nav className="mt-6"><p className="px-2 text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#9BAAB3]">Workspace</p><div className="mt-2 space-y-1">{navItems.map((item) => { const Icon = item.icon; const selected = view === item.view && (item.name !== "My tasks" || view === "board"); return <button key={item.name} onClick={() => setView(item.view)} className={cn("flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-[11px] font-bold transition-all", selected && item.name !== "My tasks" ? "bg-[#EAF6FF] text-[#2474A3]" : "text-[#708490] hover:bg-[#F4F8FA] hover:text-[#29465D]")}><Icon className="h-4 w-4" />{item.name}{item.name === "My tasks" && <span className="ml-auto rounded-md bg-[#FFF0EE] px-1.5 py-0.5 text-[9px] text-[#D65348]">3</span>}</button>})}</div></nav>
          <section className="mt-7"><div className="flex items-center justify-between px-2"><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#9BAAB3]">Your projects</p><button onClick={() => toast("Project creation is ready.")} className="text-[#4B92BB]"><Plus className="h-3.5 w-3.5" /></button></div><div className="mt-2 space-y-1">{[{ name: "Nimble launch", dot: "bg-[#38A9F2]" }, { name: "Mobile polish", dot: "bg-[#6EBB92]" }, { name: "Growth systems", dot: "bg-[#9B9CE8]" }].map((item) => <button key={item.name} onClick={() => selectProject(item.name)} className={cn("flex h-8 w-full items-center gap-2.5 rounded-xl px-2.5 text-[11px] font-bold transition-colors", project === item.name ? "bg-[#F4F8FA] text-[#2D4D65]" : "text-[#7B8F9C] hover:bg-[#F7FAFB]")}><span className={cn("relative h-2.5 w-2.5 rounded-full", item.dot, project === item.name && "ring-2 ring-[#BEE5F8] ring-offset-2 ring-offset-white")} />{item.name}{project === item.name && <span className="ml-auto text-[8px] font-extrabold uppercase tracking-[0.1em] text-[#4D94BB]">Focus</span>}</button>)}</div></section>
          <div className="mt-auto rounded-[18px] border border-[#DCEBF2] bg-[#F0F9FD] p-3.5"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#2680B5] shadow-sm"><Sparkles className="h-3.5 w-3.5" /></span><p className="text-[10px] font-extrabold text-[#31546B]">Weekly clarity</p></div><p className="mt-2 text-[10px] font-semibold leading-4 text-[#6F8A9A]">Your team has a clear next move on 78% of active work.</p><button onClick={() => setView("analytics")} className="mt-2 text-[10px] font-extrabold text-[#257BAA]">Open insights →</button></div>
          <button onClick={() => toast("Workspace settings are ready.")} className="mt-4 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-[#7B8F9C] hover:bg-[#F4F8FA]"><Settings2 className="h-4 w-4" />Workspace settings</button>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex min-h-17 items-center justify-between border-b border-[#E0E9EE] bg-white px-5 lg:px-7">
            <div className="flex items-center gap-3"><div className="flex items-center gap-2 lg:hidden"><img src="/manus-storage/tasknest-mark_1fcfb7d8.png" alt="TaskNest" className="h-8 w-8" /><span className="font-extrabold tracking-[-0.05em]">TaskNest</span></div><div className="hidden lg:block"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8498A5]">Projects / <span className="text-[#2A7BA9]">{project}</span></p><div className="mt-0.5 flex items-center gap-2"><h1 className="font-['DM_Serif_Display'] text-[18px] text-[#253F5C]">Shape the week before it shapes you.</h1><span className="relative h-2 w-2 rounded-full border border-[#38A9F2]"><span className="absolute left-0.5 top-0.5 h-0.5 w-0.5 rounded-full bg-[#38A9F2]" /></span></div></div></div>
            <div className="flex items-center gap-2"><button onClick={() => toast("No new urgent updates.")} className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#E0E9EE] text-[#617989] hover:bg-[#F4F8FA]" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF6B5E]" /></button><div className="hidden items-center gap-2 px-1 sm:flex"><TeamFaces members={team.slice(0, 3)} /><button onClick={() => toast("Collaboration panel opened.")} className="rounded-lg p-1 text-[#68808F] hover:bg-[#F4F8FA]"><UsersRound className="h-4 w-4" /></button></div><Button onClick={() => toast("A new task draft is ready to be defined.")} className="h-8 rounded-xl bg-[#FF6B5E] px-3 text-[11px] font-extrabold text-white shadow-[0_7px_16px_rgba(255,107,94,0.22)] transition-transform hover:bg-[#E95A4F] active:scale-[0.97]"><Plus className="mr-1 h-3.5 w-3.5" />New task</Button></div>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="relative overflow-hidden bg-[#EAF7FE] px-5 py-4 lg:px-7"><img src="/manus-storage/tasknest-wave-field_1dfe5e9b.png" alt="Soft abstract workflow contours" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-65 mix-blend-multiply" /><div className="relative z-10 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#5B8DAA]">Current cycle</p><p className="mt-0.5 text-[13px] font-extrabold text-[#245779]">Oct 14 — Oct 25</p></div><div className="hidden h-7 w-px bg-[#B8DCEB] sm:block" /><div className="hidden sm:block"><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#5B8DAA]">Focus</p><p className="mt-0.5 text-[13px] font-extrabold text-[#245779]">Release readiness</p></div></div><div className="hidden items-center gap-2 md:flex"><span className="flex h-2 w-2 rounded-full bg-[#6EBB92]" /><span className="text-[10px] font-bold text-[#47748D]">5 teammates collaborating now</span></div></div></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2EBF0] bg-white px-5 py-3 lg:px-7"><Tabs value={view} onValueChange={(value) => setView(value as View)}><TabsList className="h-8 rounded-xl bg-[#F1F5F7] p-1"><TabsTrigger value="board" className="rounded-lg px-3 text-[10px] font-extrabold text-[#718491] data-[state=active]:bg-white data-[state=active]:text-[#276F9B] data-[state=active]:shadow-sm"><FolderKanban className="mr-1.5 h-3.5 w-3.5" />Board</TabsTrigger><TabsTrigger value="calendar" className="rounded-lg px-3 text-[10px] font-extrabold text-[#718491] data-[state=active]:bg-white data-[state=active]:text-[#276F9B] data-[state=active]:shadow-sm"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />Calendar</TabsTrigger><TabsTrigger value="analytics" className="rounded-lg px-3 text-[10px] font-extrabold text-[#718491] data-[state=active]:bg-white data-[state=active]:text-[#276F9B] data-[state=active]:shadow-sm"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Analytics</TabsTrigger></TabsList></Tabs><div className="flex items-center gap-2"><button onClick={() => toast("Filters are ready for assignee, label, and status.")} className="rounded-lg border border-[#E0E9EE] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#637B8A] hover:bg-[#F6FAFB]"><ListChecks className="mr-1 inline h-3.5 w-3.5" />Filter</button><button onClick={() => toast("Board sorting is ready.")} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-[#7A8E9B] hover:bg-[#F4F8FA]"><ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />Sort</button></div></div>

            <div className="flex min-h-0 flex-1 flex-col bg-[#FBFCFD]">
              <div className="grid gap-px overflow-hidden border-y border-[#E1EAF0] bg-[#E1EAF0] px-5 pt-4 lg:grid-cols-4 lg:px-7">
                <MetricCard label="Open work" value="12" delta="2 added this week" icon={Target} accent="bg-[#ECF7FD] text-[#3285B4]" />
                <MetricCard label="Due this week" value="5" delta="1 needs attention" icon={Clock3} accent="bg-[#FFF1EF] text-[#E4584D]" />
                <MetricCard label="Completion" value="74%" delta="↑ 12% from last cycle" icon={Target} accent="bg-[#EEF8F1] text-[#559A70]" />
                <MetricCard label="Team flow" value="Good" delta="No blocked work" icon={TrendingUp} accent="bg-[#F3F2FE] text-[#7272BA]" />
              </div>
              {view === "board" && <BoardView tasks={tasks} openTask={setSelectedTaskId} onDragStart={(event, id) => event.dataTransfer.setData("text/plain", id)} onDrop={handleDrop} />}
              {view === "calendar" && <CalendarView tasks={tasks} openTask={setSelectedTaskId} />}
              {view === "analytics" && <AnalyticsView tasks={tasks} />}
            </div>
          </div>
        </section>
      </div>

      <Sheet open={Boolean(activeTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full overflow-y-auto border-l border-[#DDE8EE] bg-[#FBFCFD] p-0 sm:max-w-[480px]">
          {activeTask && <div className="min-h-full"><div className="border-b border-[#E4ECF1] bg-white px-6 pb-5 pt-6"><div className="mb-4 flex items-center justify-between"><div className="flex gap-2"><Badge variant="outline" className="rounded-md border-0 bg-[#EAF6FF] text-[10px] font-bold text-[#2776A5]">{activeTask.label}</Badge><span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset", priorityClass[activeTask.priority])}>{activeTask.priority}</span></div><span className="font-mono text-[10px] font-bold text-[#91A3AE]">{activeTask.id}</span></div><SheetHeader className="text-left"><SheetTitle className="pr-8 text-[22px] font-extrabold leading-7 tracking-[-0.04em] text-[#172B4D]">{activeTask.title}</SheetTitle><SheetDescription className="sr-only">Task details, subtasks, activity, and collaboration controls.</SheetDescription></SheetHeader><div className="mt-5 flex items-center justify-between"><div className="flex items-center gap-2"><TeamFaces members={activeTask.assignees} /><button onClick={() => toast("Assignee picker is ready.")} className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-[#B8CCD7] text-[#628095] hover:bg-[#F3F8FA]"><Plus className="h-3.5 w-3.5" /></button></div><Button onClick={() => { setTasks((current) => current.map((task) => task.id === activeTask.id ? { ...task, status: task.status === "done" ? "progress" : "done" } : task)); toast.success(activeTask.status === "done" ? "Task reopened." : "Task marked complete."); }} className={cn("h-8 rounded-lg px-3 text-[10px] font-extrabold", activeTask.status === "done" ? "bg-[#EAF6FF] text-[#2376A7] hover:bg-[#DDF1FB]" : "bg-[#172B4D] text-white hover:bg-[#253D64]")}><Check className="mr-1 h-3.5 w-3.5" />{activeTask.status === "done" ? "Reopen" : "Complete"}</Button></div></div>
            <div className="space-y-6 px-6 py-6"><section><p className="section-label">Task brief</p><p className="mt-2 text-[12px] font-medium leading-5 text-[#526B7B]">{activeTask.description}</p></section><section className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#E2EBF0] bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Due</p><p className={cn("mt-1 text-[12px] font-extrabold", activeTask.due === "Today" ? "text-[#D95248]" : "text-[#2B526B]")}>{activeTask.due}</p></div><div className="rounded-xl border border-[#E2EBF0] bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Status</p><p className="mt-1 text-[12px] font-extrabold capitalize text-[#2B526B]">{columns.find((column) => column.id === activeTask.status)?.title}</p></div></section>
              <section><div className="flex items-center justify-between"><p className="section-label">Subtasks</p><span className="text-[10px] font-bold text-[#78909F]">{activeTask.subtasks.filter((subtask) => subtask.done).length}/{activeTask.subtasks.length} done</span></div><div className="mt-2 overflow-hidden rounded-xl border border-[#E2EBF0] bg-white">{activeTask.subtasks.map((subtask, index) => <label key={subtask.title} className="flex cursor-pointer items-center gap-2.5 border-b border-[#EEF3F5] px-3 py-3 last:border-b-0"><Checkbox checked={subtask.done} onCheckedChange={() => handleToggleSubtask(index)} className="h-4 w-4 border-[#B8CAD5] data-[state=checked]:border-[#38A9F2] data-[state=checked]:bg-[#38A9F2]" /><span className={cn("text-[11px] font-semibold", subtask.done ? "text-[#8C9EA9] line-through" : "text-[#395269]")}>{subtask.title}</span></label>)}</div></section>
              <section><div className="flex items-center justify-between"><p className="section-label">Files</p><button onClick={() => toast("Attachment picker is ready for your files.")} className="text-[10px] font-extrabold text-[#2778A9]"><Plus className="mr-0.5 inline h-3 w-3" />Add file</button></div><div className="mt-2 flex items-center gap-2 rounded-xl border border-[#E2EBF0] bg-white p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF0EE] text-[#E55D52]"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-extrabold text-[#3A5269]">task-detail-notes.pdf</p><p className="text-[9px] font-medium text-[#91A3AE]">2.4 MB · updated today</p></div><button onClick={() => toast("File details opened.")} className="text-[#8AA0AD]"><Ellipsis className="h-4 w-4" /></button></div></section>
              <section><div className="flex items-center justify-between"><p className="section-label">Conversation</p><span className="text-[10px] font-bold text-[#78909F]">{activeTask.comments} notes</span></div><div className="mt-3 flex gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className="bg-[#BDE6FF] text-[9px] font-extrabold text-[#1A5C82]">EP</AvatarFallback></Avatar><div className="rounded-xl rounded-tl-sm bg-[#EAF6FF] px-3 py-2 text-[11px] font-semibold leading-5 text-[#477084]">{activeTask.activity}</div></div><div className="mt-3 flex gap-2"><Input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleComment()} placeholder="Leave a useful note…" className="h-9 rounded-xl border-[#DCE8EE] bg-white text-[11px] placeholder:text-[#A4B3BC] focus-visible:ring-[#38A9F2]" /><Button onClick={handleComment} size="icon" className="h-9 w-9 shrink-0 rounded-xl bg-[#38A9F2] hover:bg-[#248FCC]"><Send className="h-3.5 w-3.5" /></Button></div></section></div></div>}
        </SheetContent>
      </Sheet>
    </main>
  );
}
