// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { fetchCurrentUser, selectIsAuthenticated, selectUserRole, selectAuthStatus } from './features/auth/authSlice';

// ── Public Website ────────────────────────────────────────────────────────
import PublicLayout      from './public-website/layouts/PublicLayout';
import Home              from './public-website/pages/Home';
import Programs          from './public-website/pages/Programs';
import Workshops         from './public-website/pages/Workshops';
import WorkshopDetails   from './public-website/pages/WorkshopDetails';
import WorkshopRegister  from './public-website/pages/WorkshopRegister';
import About             from './public-website/pages/About';
import Contact           from './public-website/pages/Contact';
import Signup            from './public-website/pages/Signup';
import LmsRegistration   from './public-website/pages/LmsRegistration';


// ── LMS Layouts ───────────────────────────────────────────────────────────
import AdminLayout   from './components/admin/AdminLayout';
import TrainerLayout from './components/trainer/TrainerLayout';
import TraineeLayout from './components/trainee/TraineeLayout';
import HRLayout      from './components/hr/HRLayout';

// ── Pages ─────────────────────────────────────────────────────────────────
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';

import AdminDashboard    from './pages/admin/Dashboard';
import AdminTrainees     from './pages/admin/Trainees';
import AdminTrainers     from './pages/admin/Trainers';
import AdminBatches      from './pages/admin/Batches';
import AdminSessions     from './pages/admin/Sessions';
import AdminLmsAttendance from './pages/admin/LmsAttendance';
import AdminRecordings   from './pages/admin/Recordings';
import AdminRecordingPlayback from './pages/admin/RecordingPlayback';
import AdminFeedback from './pages/admin/Feedback';
import AdminLmsContent   from './pages/admin/LmsContent';
import AdminAssignments  from './pages/admin/Assignments';
import AdminModuleAssessments from './pages/admin/ModuleAssessments';
import AdminRegistrations from './pages/admin/Registrations';
import AdminPrograms     from './pages/admin/Programs';
import AdminUsers        from './pages/admin/Users';
import AdminSettings     from './pages/admin/Settings';
import AdminReports      from './pages/admin/Reports';
import AdminSupport      from './pages/admin/Support';

import AdminWorkshopDashboard      from './pages/admin/workshops/WorkshopDashboard';
import WorkshopManagement          from './pages/admin/workshops/WorkshopManagement';
import WorkshopRegistrationsAdmin  from './pages/admin/workshops/WorkshopRegistrations';
import WorkshopLiveSessions    from './pages/admin/workshops/LiveSessions';
import WorkshopAttendance         from './pages/admin/workshops/WorkshopAttendanceReal';
import AdminWorkshopFeedback      from './pages/admin/workshops/WorkshopFeedback';
import AdminWorkshopCertificates  from './pages/admin/workshops/WorkshopCertificates';
import WorkshopReports         from './pages/admin/workshops/WorkshopReports';
import WorkshopBatchesAdmin      from './pages/admin/workshops/WorkshopBatches';


import AdminPipeline from './pages/admin/Pipeline';
import AdminInterviews from './pages/admin/Interviews';
import BatchDetails from './pages/admin/BatchDetails';


import Courses from './pages/admin/Courses';
import Profile from './pages/admin/Profilepage';
import CourseDetail from './pages/admin/CourseDetail';
import CourseCurriculumEditor from './pages/admin/CourseCurriculumEditor';
import CourseSegment from './pages/trainee/CourseSegment';
import LessonPlayer from './pages/trainee/LessonPlayer';
import CourseTopic from './pages/trainee/CourseTopic';



import WhatsAppButton from "./pages/WhatsAppButton";




import TrainerDashboard  from './pages/trainer/Dashboard';
import TrainerSessions   from './pages/trainer/Sessions';
import TrainerAttendance from './pages/trainer/Attendance';
import TrainerRecordings from './pages/trainer/Recordings';
import TrainerRecordingPlayback from './pages/trainer/RecordingPlayback';
import TrainerFeedback from './pages/trainer/Feedback';
import TrainerAssignments from './pages/trainer/Assignments';
import TrainerModuleAssessments from './pages/trainer/ModuleAssessments';
import TrainerSettings from './pages/trainer/Settings';
import SessionDetail from './pages/trainer/SessionDetail';
import MyWorkshops          from './pages/trainer/MyWorkshops';
import TrainerBatches       from './pages/trainer/TrainerBatches';
import LiveWorkshop         from './pages/trainer/LiveWorkshop';
import WorkshopParticipants from './pages/trainer/WorkshopParticipants';
import WorkshopResources    from './pages/trainer/WorkshopResources';
import WorkshopFeedback     from './pages/trainer/WorkshopFeedback';
import TrainerWorkshopAttendance from './pages/trainer/WorkshopAttendance';
import WorkshopCertificates from './pages/trainer/WorkshopCertificates';



import TraineeDashboard  from './pages/trainee/Dashboard';
import TraineeSessions   from './pages/trainee/Sessions';
import TraineeAttendance from './pages/trainee/TraineeAttendance';
import TraineeAssignments from './pages/trainee/Assignments';
import TraineeModuleAssessments from './pages/trainee/ModuleAssessments';
import TraineeSettings from './pages/trainee/Settings';
import TraineeCourses from './pages/trainee/Trainee_Courses';
import TraineeCourseDetail from './pages/trainee/Trainee_CourseDetail';
import TraineeWorkshopFeedback from './pages/trainee/WorkshopFeedback';
import TraineeProgress from './pages/trainee/Progress';
import TraineeCertificates from './pages/trainee/TraineeCertificates';
import GlobalSearch from './pages/shared/GlobalSearch';




import HRDashboard   from './pages/hr/Dashboard';
import HRInterviews  from './pages/hr/Interviews';
import HRPipeline    from './pages/hr/Pipeline';
import HREvaluation  from './pages/hr/Evaluation';
import HREvaluationsList from './pages/hr/EvaluationsList';
import HRSettings from './pages/hr/Settings';

// ── Protected Route ───────────────────────────────────────────────────────
function ProtectedRoute({ allowedRoles }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const role            = useAppSelector(selectUserRole);
  const authStatus      = useAppSelector(selectAuthStatus);

  if (authStatus === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: '#64748b' }}>
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// ── Role redirect after login ─────────────────────────────────────────────
// Always show landing page at "/". Logged-in users can go to dashboard via Navbar.
function RoleRedirect() {
  return <Home />;
}

// ── App ───────────────────────────────────────────────────────────────────
function App() {
  const dispatch        = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  

  // Re-hydrate user on page reload; validate stale persisted sessions
  useEffect(() => {
    if (isAuthenticated) dispatch(fetchCurrentUser());
  }, []); // eslint-disable-line

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* ── Auth pages (no layout wrapper) ──────────────────────────── */}
        <Route path="/login"                element={<LoginPage />} />
        <Route path="/register"             element={<Navigate to="/signup" replace />} />
        <Route path="/forgot_password"      element={<ForgotPasswordPage />} />
        <Route path="/force-password-change" element={<ForcePasswordChangePage />} />

        {/* ── Public Landing Website ──────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route path="/"                      element={<RoleRedirect />} />
          <Route path="/programs"              element={<Programs />} />
          <Route path="/workshops"             element={<Workshops />} />
          <Route path="/workshops/:id"         element={<WorkshopDetails />} />
          <Route path="/workshop/register"     element={<WorkshopRegister />} />
          <Route path="/about"                 element={<About />} />
          <Route path="/contact"               element={<Contact />} />
          <Route path="/signup"                element={<Signup />} />
          <Route path="/lms-registration"      element={<LmsRegistration />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>

            <Route path="dashboard"     element={<AdminDashboard />} />
            <Route path="search"        element={<GlobalSearch />} />
            <Route path="trainees"      element={<AdminTrainees />} />
            <Route path="trainers"      element={<AdminTrainers />} />
            <Route path="workshops"                element={<AdminWorkshopDashboard />} />
            <Route path="workshops/dashboard"       element={<AdminWorkshopDashboard />} />
            <Route path="workshops/management"      element={<WorkshopManagement />} />
            <Route path="workshops/management/create" element={<WorkshopManagement />} />
            <Route path="workshops/management/:id"    element={<WorkshopManagement />} />
            <Route path="workshops/registrations"      element={<WorkshopRegistrationsAdmin />} />
            <Route path="workshops/live-sessions"      element={<WorkshopLiveSessions />} />
            <Route path="workshops/attendance"      element={<WorkshopAttendance />} />
            <Route path="workshops/feedback"        element={<AdminWorkshopFeedback />} />
            <Route path="workshops/certificates"    element={<AdminWorkshopCertificates />} />
            <Route path="workshops/reports"         element={<WorkshopReports />} />
            <Route path="workshops/batches"       element={<WorkshopBatchesAdmin />} />

            <Route path="batches"       element={<AdminBatches />} />

            <Route path="sessions"      element={<AdminSessions />} />
            <Route path="attendance"    element={<AdminLmsAttendance />} />
            <Route path="recordings"    element={<AdminRecordings />} />
            <Route path="recordings/:id" element={<AdminRecordingPlayback />} />
            <Route path="feedback" element={<AdminFeedback />} />
            <Route path="lms"           element={<AdminLmsContent />} />
            <Route path="assignments"  element={<AdminAssignments />} />
            <Route path="module-assessments" element={<AdminModuleAssessments />} />
            <Route path="registrations" element={<AdminRegistrations />} />
            <Route path="programs"      element={<AdminPrograms />} />
            <Route path="users"         element={<AdminUsers />} />
            <Route path="courses"         element={<Courses />} />
            <Route path="pipeline"        element={<AdminPipeline />} />
            <Route path="interviews"      element={<AdminInterviews />} />
            <Route path="settings"     element={<AdminSettings />} />
            <Route path="reports"      element={<AdminReports />} />
            <Route path="support"      element={<AdminSupport />} />
            <Route path="profile" element={<Profile />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="courses/:id/edit" element={<CourseCurriculumEditor/>} />
           <Route path="batches/view/:id" element={<BatchDetails />} />
            <Route index element={<Navigate to="dashboard" replace />} />


          </Route>

        </Route>

        {/* Trainer */}
        <Route element={<ProtectedRoute allowedRoles={['trainer']} />}>
          <Route path="/trainer" element={<TrainerLayout />}>
            <Route path="dashboard"   element={<TrainerDashboard />} />
            <Route path="search"      element={<GlobalSearch />} />
              <Route path="batches"       element={<TrainerBatches />} />
            <Route path="sessions"    element={<TrainerSessions />} />
            <Route path="attendance"  element={<TrainerAttendance />} />
            <Route path="recordings"  element={<TrainerRecordings />} />
            <Route path="recordings/:id" element={<TrainerRecordingPlayback />} />
            <Route path="feedback" element={<TrainerFeedback />} />
            <Route path="assignments" element={<TrainerAssignments />} />
            <Route path="module-assessments" element={<TrainerModuleAssessments />} />
            <Route path="settings"     element={<TrainerSettings />} />
            <Route path="sessions/new"      element={<SessionDetail mode="create" />} />
            <Route path="sessions/:id"      element={<SessionDetail mode="view" />} />
            <Route path="sessions/:id/edit" element={<SessionDetail mode="edit" />} />
            <Route path="batches/view/:id"  element={<BatchDetails />} />
            <Route path="workshops"              element={<MyWorkshops />} />
            <Route path="workshop-batches"        element={<TrainerBatches />} />
            <Route path="workshops/live"         element={<LiveWorkshop />} />
            <Route path="workshops/attendance"  element={<TrainerWorkshopAttendance />} />
            <Route path="workshops/participants" element={<WorkshopParticipants />} />
            <Route path="workshops/resources"    element={<WorkshopResources />} />
            <Route path="workshops/feedback"     element={<WorkshopFeedback />} />
            <Route path="workshops/certificates" element={<WorkshopCertificates />} />
            <Route path="profile" element={<Profile />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Route>

        {/* Trainee */}
        <Route element={<ProtectedRoute allowedRoles={['trainee']} />}>
          <Route path="/trainee" element={<TraineeLayout />}>
<Route path="dashboard"   element={<TraineeDashboard />} />
          <Route path="search"      element={<GlobalSearch />} />
          <Route path="sessions"    element={<TraineeSessions />} />
          <Route path="attendance"  element={<TraineeAttendance />} />
          <Route path="assignments" element={<TraineeAssignments />} />
          <Route path="module-assessments" element={<TraineeModuleAssessments />} />
          <Route path="feedback" element={<TraineeWorkshopFeedback />} />
          <Route path="progress"  element={<TraineeProgress />} />
          <Route path="certificates" element={<TraineeCertificates />} />
          <Route path="settings"    element={<TraineeSettings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="courses" element={<TraineeCourses />} />
          <Route path="coursess/:id" element={<TraineeCourseDetail />} />
          <Route path="coursess/:courseId" element={<TraineeCourseDetail />} />
          <Route path="coursess/:courseId/segment/:segmentId" element={<CourseSegment />} />
          <Route path="coursess/:courseId/segment/:segmentId/:topicId" element={<CourseTopic />} />
          <Route path="coursess/:courseId/segment/:segmentId/:topicId/:lessonId" element={<LessonPlayer />} />      
          <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Route>

        {/* HR */}
        <Route element={<ProtectedRoute allowedRoles={['hr']} />}>
          <Route path="/hr" element={<HRLayout />}>
            <Route path="dashboard"  element={<HRDashboard />} />
            <Route path="search"     element={<GlobalSearch />} />
            <Route path="interviews" element={<HRInterviews />} />
            <Route path="pipeline"   element={<HRPipeline />} />
            <Route path="evaluations" element={<HREvaluationsList />} />
            <Route path="evaluation/:id" element={<HREvaluation />} />
            <Route path="settings" element={<HRSettings />} />
             <Route path="profile" element={<Profile />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
        </Route>

        {/* 404 — send unknown URLs to the public home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>


      {isAuthenticated && <WhatsAppButton />}
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />


       

    </BrowserRouter>
  );
}

export default App;
