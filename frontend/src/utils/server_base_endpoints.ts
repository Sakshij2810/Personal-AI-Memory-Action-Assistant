export const server_base_endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    logout: "/api/v1/auth/logout",
    me: "/api/v1/auth/me",
  },
  media: {
    upload_single_img: "/api/v1/media/upload/single",
    upload_multiple_img: "/api/v1/media/upload/multiple",
    get_all_images: "/api/v1/media",
    delete_img: (id: string) => `/api/v1/media/${id}`,
  },
};
