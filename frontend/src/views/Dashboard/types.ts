import {
  FiUsers,
  FiCalendar,
  FiSearch,
  FiFileText,
  FiImage,
  FiGitBranch,
  FiCheckSquare,
  FiMic,
} from "react-icons/fi";

import { REACT_APP_NAV_ROUTES } from "../../Router/AppNavigation";

export const NAV_ITEMS = [
  {
    icon: FiUsers,
    label: "People Recognition",
    path: REACT_APP_NAV_ROUTES.people_recognition,
    comingSoon: true,
  },
  {
    icon: FiCalendar,
    label: "Event & Memory Organizer",
    path: REACT_APP_NAV_ROUTES.event_organizer,
    comingSoon: true,
  },
  {
    icon: FiSearch,
    label: "Memory Search",
    path: REACT_APP_NAV_ROUTES.memory_search,
    comingSoon: true,
  },
  {
    icon: FiFileText,
    label: "Document Intelligence",
    path: REACT_APP_NAV_ROUTES.document_intelligence,
    comingSoon: true,
  },
  {
    icon: FiImage,
    label: "Album & Collection Creator",
    path: REACT_APP_NAV_ROUTES.album_creator,
    comingSoon: true,
  },
  {
    icon: FiGitBranch,
    label: "Personal Memory Insights",
    path: REACT_APP_NAV_ROUTES.memory_insights,
    comingSoon: true,
  },
  {
    icon: FiCheckSquare,
    label: "Personal Task Assistant",
    path: REACT_APP_NAV_ROUTES.task_assistant,
    comingSoon: true,
  },
  {
    icon: FiMic,
    label: "Voice Assistant",
    path: REACT_APP_NAV_ROUTES.voice_assistant,
    comingSoon: true,
  },
] as const;

export const STORAGE_ITEMS = [
  {
    icon: FiImage,
    label: "Image Gallery",
    path: REACT_APP_NAV_ROUTES.image_gallery,
    comingSoon: true,
  },
] as const;
