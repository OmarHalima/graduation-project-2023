# AI-Powered Project Management System

An innovative project management platform that integrates artificial intelligence with modern web technologies to enhance project planning, execution, and monitoring.

## Features

- 🤖 **AI-Powered Tools**: Intelligent task management, automated workflow optimization, and predictive analytics
- 🔄 **Real-time Collaboration**: Instant updates and notifications for team activities
- 📊 **Advanced Analytics**: Comprehensive dashboards and data visualization
- 🔒 **Enterprise-grade Security**: Multi-factor authentication and role-based access control
- 📱 **Responsive Design**: Works seamlessly across desktop and mobile devices

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and bundling
- **TailwindCSS** & **Material-UI** for styling
- **Chart.js** & **Recharts** for data visualization
- **React Beautiful DND** for drag-and-drop interfaces

### Backend
- **Supabase** for database, authentication, and storage
- **Express** for additional server functionality
- **Google AI** & **OpenAI** integrations for AI capabilities
- **PDF.js** for document processing

## Getting Started

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/ai-project-management.git
   cd ai-project-management
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials and other required values
   ```

4. Start the development server
   ```bash
   npm run dev
   ```

## Database Schema

The application uses the following main tables:

- **users**: User profiles and authentication data
- **projects**: Project information and metadata
- **project_members**: Team member assignments to projects
- **tasks**: Task management and assignment
- **phases**: Project phases and timelines
- **knowledge_base**: Project documentation repository
- **project_activity_logs**: Audit trail for project activities

## API Reference

### Authentication
- User registration and login
- Multi-factor authentication
- Password recovery

### Projects
- CRUD operations for projects
- Team management
- Permission settings

### Tasks
- Task creation and assignment
- Status tracking
- Priority management

### AI Services
- DeepSearch for project content
- Task automation
- Predictive analytics

## User Flows

### Authentication Flow
1. Sign up → Email verification → Profile completion → Optional MFA setup

### Project Management
1. Create project → Add team members → Define phases → Create tasks → Monitor progress

### Task Management
1. Create tasks → Assign to team members → Update status → Track completion

## Deployment

The application supports deployment on:

- **Vercel**: Configuration in `vercel.json`
- **Netlify**: Configuration in `netlify.toml`
- **Supabase**: Edge functions for server-side logic

## Security Features

- Email verification for new accounts
- Multi-factor authentication (MFA)
- Row-level security policies
- Role-based access control
- Activity logging and monitoring

## Project Structure

```
project/
├── src/                # Source code
│   ├── api/           # API integration
│   ├── components/    # Reusable UI components
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions
│   ├── pages/         # Page components
│   ├── routes/        # Routing configuration
│   ├── services/      # Service layer
│   └── types/         # TypeScript type definitions
├── public/            # Static assets
├── server/            # Backend server code
└── supabase/          # Supabase configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Supabase for their excellent BaaS platform
- OpenAI for their AI capabilities
- All open-source libraries used in this project 