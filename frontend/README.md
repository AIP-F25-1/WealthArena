# WealthArena UI

A comprehensive investment and wealth management mobile application built with React Native and Expo, designed to gamify financial learning and portfolio management.

## 🎯 About WealthArena

WealthArena is an innovative investment platform that combines financial education with gamification to help users learn about investing while building real portfolios. The app provides a complete ecosystem for investment simulation, portfolio management, and financial analytics.

## 🚀 Key Features

### 📱 **Core Screens & Navigation**
- **Landing Page**: Welcome screen with app introduction
- **Authentication**: Secure login and signup with onboarding flow
- **Splash Screen**: Branded loading experience
- **Tab Navigation**: Intuitive bottom navigation with three main sections

### 🏠 **Dashboard**
- Real-time portfolio overview and performance metrics
- Market trends and investment insights
- Quick access to key investment tools
- Personalized recommendations based on user tier

### 🎮 **Investment Game**
- Gamified investment simulation environment
- Risk-free learning with virtual portfolios
- Achievement system and progress tracking


### 👤 **Profile Management**
- User account settings and preferences
- Investment history and performance analytics
- Tier-based user system with different access levels
- Personal financial goals tracking

### 🛠 **Advanced Features**
- **Portfolio Builder**: Comprehensive portfolio creation and management
- **Trade Simulator**: Real-time trading simulation with market data
- **Strategy Lab**: Investment strategy testing and backtesting
- **Analytics Dashboard**: Detailed performance metrics and insights
- **Explainability**: AI-powered investment decision explanations
- **Admin Portal**: Administrative controls and user management
- **Notifications**: Real-time alerts and updates

## 🏗 Technical Architecture

### **Frontend Stack**
- **React Native**: Cross-platform mobile development
- **Expo Router**: File-based routing system
- **TypeScript**: Type-safe development
- **NativeWind**: Tailwind CSS for React Native
- **Zustand**: Lightweight state management
- **React Query**: Server state management and caching
- **Lucide React Native**: Beautiful icon library

### **Platform Support**
- **iOS**: Native iOS application
- **Android**: Native Android application  
- **Web**: Progressive web application support

## 📁 Project Structure

```
├── app/                          # Application screens (Expo Router)
│   ├── (tabs)/                  # Tab navigation screens
│   │   ├── dashboard.tsx        # Main dashboard screen
│   │   ├── game.tsx            # Investment game interface
│   │   ├── profile.tsx         # User profile management
│   │   └── _layout.tsx         # Tab layout configuration
│   ├── admin-portal.tsx        # Administrative interface
│   ├── analytics.tsx           # Analytics dashboard
│   ├── explainability.tsx      # AI explanation features
│   ├── landing.tsx             # Landing page
│   ├── login.tsx               # User authentication
│   ├── signup.tsx              # User registration
│   ├── onboarding.tsx          # User onboarding flow
│   ├── portfolio-builder.tsx   # Portfolio creation tool
│   ├── trade-simulator.tsx     # Trading simulation
│   ├── strategy-lab.tsx        # Strategy testing environment
│   ├── notifications.tsx       # Notification center
│   ├── splash.tsx              # App splash screen
│   ├── _layout.tsx             # Root layout configuration
│   └── +not-found.tsx          # 404 error screen
├── assets/                      # Static assets
│   └── images/                 # App icons and images
├── constants/                   # App constants and configuration
│   └── colors.ts               # Color theme definitions
├── contexts/                    # React contexts
│   └── UserTierContext.tsx     # User tier management
├── app.json                    # Expo configuration
├── package.json                # Dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Bun package manager
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AIP-F25-1/WealthArena.git
   cd WealthArena
   git checkout ui
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Start the development server**:
   ```bash
   # For web preview
   bun run start-web
   
   # For mobile development
   bun run start
   ```

### Development Workflow

- **Web Development**: `bun run start-web` for instant browser preview
- **iOS Development**: `bun run start` then press 'i' for iOS Simulator
- **Android Development**: `bun run start` then press 'a' for Android Emulator
- **Device Testing**: Use Expo Go app to scan QR code

##  User Experience Features

### **Gamification Elements**
- Achievement badges and progress tracking
- Investment challenges and educational quests
- Leaderboards and social comparison
- Virtual rewards and tier progression

### **Educational Components**
- Interactive tutorials and guides
- Risk assessment tools
- Investment strategy explanations
- Market analysis and insights

### **Personalization**
- User tier system (Bronze, Silver, Gold, Platinum)
- Customizable dashboard layouts
- Personalized investment recommendations
- Adaptive learning paths

##  Configuration

### **Environment Setup**
The app uses Expo configuration in `app.json` for:
- App metadata and branding
- Platform-specific settings
- Build configurations
- Deep linking setup

### **Styling System**
- NativeWind for utility-first styling
- Custom color themes in `constants/colors.ts`
- Responsive design patterns
- Dark Mode support
light mode support

##  Deployment

### **Mobile App Stores**
```bash
# Install EAS CLI
bun i -g @expo/eas-cli

# Configure builds
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### **Web Deployment**
```bash
# Build for web
eas build --platform web

# Deploy to hosting
eas hosting:configure
eas hosting:deploy
```

##  Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

##  License

This project is part of the WealthArena ecosystem and follows the project's licensing terms.

##  Related Repositories

- **Backend API**: Integration with WealthArena backend services
- **Machine Learning**: AI-powered investment recommendations
- **Database**: User data and portfolio management
- **Analytics**: Performance tracking and insights

---

**WealthArena UI** - Empowering financial literacy through gamified investment education.