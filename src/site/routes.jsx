/**
 * The site's pages, in one module so main.jsx can import them AFTER the lesson
 * catalog has loaded (navData.js builds the menu from CATEGORIES at import time).
 */
import Landing from './Landing.jsx';
import TeacherPage from './TeacherPage.jsx';
import ResourcePage from './ResourcePage.jsx';
import LessonsIndex from './LessonsIndex.jsx';
import CategoryPage from './CategoryPage.jsx';
import LessonPage from './LessonPage.jsx';
import VerifyPage from './VerifyPage.jsx';
import TeachPage from './TeachPage.jsx';

export const routes = { Landing, TeacherPage, ResourcePage, LessonsIndex, CategoryPage, LessonPage, VerifyPage, TeachPage };
