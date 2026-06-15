import axios from "axios";

const axiosInstance = axios.create({
  baseURL: 'http://193.181.209.14:9595', // ✅ Your API Gateway
  withCredentials: true,            // if using cookies or sessions
});

export default axiosInstance;