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
    path: REACT_APP_NAV_ROUTES.peopleRecognition,
    comingSoon: true,
  },
  {
    icon: FiCalendar,
    label: "Event & Memory Organizer",
    path: REACT_APP_NAV_ROUTES.eventOrganizer,
    comingSoon: true,
  },
  {
    icon: FiSearch,
    label: "Memory Search",
    path: REACT_APP_NAV_ROUTES.memorySearch,
    comingSoon: true,
  },
  {
    icon: FiFileText,
    label: "Document Intelligence",
    path: REACT_APP_NAV_ROUTES.documentIntelligence,
    comingSoon: true,
  },
  {
    icon: FiImage,
    label: "Album & Collection Creator",
    path: REACT_APP_NAV_ROUTES.albumCreator,
    comingSoon: true,
  },
  {
    icon: FiGitBranch,
    label: "Personal Memory Insights",
    path: REACT_APP_NAV_ROUTES.memoryInsights,
    comingSoon: true,
  },
  {
    icon: FiCheckSquare,
    label: "Personal Task Assistant",
    path: REACT_APP_NAV_ROUTES.taskAssistant,
    comingSoon: true,
  },
  {
    icon: FiMic,
    label: "Voice Assistant",
    path: REACT_APP_NAV_ROUTES.voiceAssistant,
    comingSoon: true,
  },
] as const;
