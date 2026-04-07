# blazion

A lightweight, strictly-typed, zero-dependency fetch wrapper explicitly built for the `@quokkalabs.com` team. Designed for consistent, object-based API definitions.

## 1. Installation

To install the package, simply run:
```bash
npm install blazion
```
*(Note: You must have an `@quokkalabs.com` email configured in your `git config` to install this package).*

---

## 2. Setting Up an Instance and Interceptors

It's best practice to create a configured instance of the fetcher, apply your global interceptors, and export it for your app.

Create a file called `api.ts`:

```typescript
import { createBlazion, ResponseType } from 'blazion';

// 1. Create a custom instance with a base URL
const apiHeader = createBlazion({
  baseURL: 'https://api.quokkalabs.com/v1',
});

// 2. Add fluent event hooks!
apiHeader
  .onRequest((config) => {
    const token = localStorage.getItem('user_token');
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    }
    return config;
  })
  .onResponse((data, response) => {
    return data;
  })
  .onError((error) => {
    console.error("Global API Error:", error.message);
  });

export default apiHeader;
```

---

## 3. Standardized Usage (API Dictionary Pattern)

To maintain 100% consistency, the library enforces a single `qf(apiObj)` pattern. This allows you to define your endpoints as objects in centralized files.

#### **Step 1: Define your endpoints**
```typescript
// endpoints.ts
import { HttpMethod } from 'blazion';

export const UserEndpoints = {
  GET_PROFILE: { 
    url: "/user/profile", 
    method: 'GET' 
  },
  UPDATE_PROFILE: { 
    url: "/user/profile", 
    method: 'PUT',
    timeout: 5000 
  },
};
```

#### **Step 2: Use them in Components**
```typescript
import api from './api';
import { UserEndpoints } from './endpoints';

async function updateProfile(userData: any) {
  try {
    // Standardized object spreading
    const user = await api({
      ...UserEndpoints.UPDATE_PROFILE,
      payload: userData, // Body content goes here
      params: { force: true } // Query params (?force=true)
    });
    
    console.log(`Updated ${user.name}`);
  } catch (error) {
    console.error("Update failed:", error.message);
  }
}
```

---

## 4. Features & Auto-Detection

### **Automatic Content-Type Detection**
`blazion` automatically detects your payload type to set the correct `Content-Type`:
- **Generic Object** → `application/json`
- **FormData** → `multipart/form-data`
- **URLSearchParams** → `application/x-www-form-urlencoded`
- **Blob/Binary** → Extracts native type or defaults to `text/plain`

### **Custom Response Formats**
Use `responseType` to dictate exactly what you want back:
```typescript
import { ResponseType } from 'blazion';

const audioBlob = await api({
  url: '/audio/track.mp3',
  method: 'GET',
  responseType: ResponseType.BLOB
});
```

### **Strict Type Safety**
The library is 100% strictly typed (No `any`, No `unknown`). Enforced via its internal architecture and linting tools.
```typescript
interface User { name: string; }
const data = await api<User>({ url: '/profile', method: 'GET' });
// data is now correctly typed as User!
```
