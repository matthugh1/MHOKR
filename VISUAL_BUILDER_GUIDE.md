# Visual OKR Builder - User Guide

The Visual OKR Builder is now fully functional with complete CRUD operations, real backend integration, and persistent canvas layouts!

## ✨ New Features

### 1. **Add Nodes** ✅
Click the "Add Node" button in the top-right to create:
- **Objectives** (Blue nodes): High-level goals
- **Key Results** (Green nodes): Measurable outcomes
- **Initiatives** (Purple nodes): Action items

### 2. **Edit Nodes** ✅
- **Hover** over any node to see the edit button
- **Click** the edit button to modify:
  - Objective: Title, Description
  - Key Result: Title, Current Value, Target Value, Unit
  - Initiative: Title, Status
- Changes are **automatically saved to database**

### 3. **Connect Nodes** ✅
- **Drag** from one node to another to create relationships
- **Objective → Key Result**: Links KRs to their parent Objective
- **Key Result → Initiative**: Links Initiatives that drive KR progress
- Connections are **automatically saved to database**

### 4. **Delete Nodes** ✅
- Click the **Delete** button in the edit dialog
- Confirms before deletion
- Removes node and all its connections

### 5. **Save Layout** ✅
- Click "Save Layout" to persist node positions
- Layouts are restored when you revisit the page
- Each OKR remembers its canvas position

### 6. **Load Existing OKRs** ✅
- Opens with all existing OKRs from database
- Shows relationships between Objectives, Key Results, and Initiatives
- Animated connections for active relationships

---

## 🎨 How to Use

### Creating Your First OKR

1. **Open the Visual Builder**
   - Navigate to: Dashboard → Visual Builder
   
2. **Add an Objective**
   - Click "Add Node" → "Objective"
   - An edit dialog opens automatically
   - Enter: "Launch AI Features"
   - Description: "Successfully launch AI-powered recommendations"
   - Click "Save"

3. **Add Key Results**
   - Click "Add Node" → "Key Result"
   - Enter: "User Adoption Rate"
   - Current: 0, Target: 5000, Unit: "users"
   - Click "Save"
   - Repeat for more KRs

4. **Connect Objective to Key Results**
   - Drag from the Objective node to each Key Result node
   - Connections turn animated (showing active relationship)
   - Relationships are saved automatically

5. **Add Initiatives**
   - Click "Add Node" → "Initiative"
   - Enter: "Marketing Campaign"
   - Status: "In Progress"
   - Drag from Key Result to Initiative to link them

6. **Arrange Your Canvas**
   - Drag nodes to organize them visually
   - Create a hierarchy that makes sense
   - Click "Save Layout" to persist positions

---

## 🎯 Node Types

### Objective (Blue Border)
- Represents high-level goals
- Has: Title, Description, Progress, Owner
- Can have multiple Key Results
- Shows overall progress percentage

### Key Result (Green Border)
- Represents measurable outcomes
- Has: Title, Current Value, Target Value, Unit
- Belongs to one Objective
- Can have multiple Initiatives
- Shows progress: Current / Target

### Initiative (Purple Border)
- Represents action items
- Has: Title, Status
- Can support a Key Result
- Shows current status

---

## 💡 Pro Tips

### Visual Hierarchy
```
Objective (Top Level)
    ├── Key Result 1
    │   ├── Initiative 1
    │   └── Initiative 2
    ├── Key Result 2
    └── Key Result 3
```

### Best Practices
1. **Start with Objectives**: Create your main goals first
2. **Add Key Results**: Define how you'll measure success
3. **Link Everything**: Connect KRs to Objectives
4. **Add Initiatives**: Break down the work
5. **Arrange Thoughtfully**: Use visual space to show relationships
6. **Save Often**: Click "Save Layout" after major changes

### Keyboard & Mouse
- **Left-click + Drag**: Move nodes
- **Drag from node edge**: Create connection
- **Mouse wheel**: Zoom in/out
- **Right-click + Drag**: Pan canvas
- **Hover**: Show edit button
- **Minimap**: Quick navigation

---

## 🔄 Syncing with Database

All changes are **automatically synced**:

✅ **Create**: New nodes are saved when you fill in details  
✅ **Update**: Edits are saved immediately  
✅ **Delete**: Removes from database  
✅ **Connect**: Relationships are saved  
✅ **Move**: Positions saved with "Save Layout"

---

## 🎬 Example Workflow

### Scenario: Launch a New Product Feature

1. **Create Objective**:
   - Title: "Launch Mobile App"
   - Description: "Successfully launch iOS and Android apps"

2. **Add Key Results**:
   - KR1: "5,000 app downloads"
   - KR2: "4.5+ star rating"
   - KR3: "50% daily active users"

3. **Connect KRs to Objective**:
   - Drag from Objective → Each Key Result

4. **Add Initiatives**:
   - "App Store Optimization"
   - "Social Media Campaign"
   - "User Onboarding Flow"
   - "Push Notifications System"

5. **Link Initiatives to KRs**:
   - ASO + Social → Downloads KR
   - Onboarding + Notifications → Active Users KR

6. **Arrange Visually**:
   - Objective at top
   - Key Results in middle row
   - Initiatives at bottom
   - Group related items

7. **Save Layout**: Click "Save Layout"

---

## 🚀 What's Next?

### Coming Soon
- **AI Suggestions**: Get recommended connections from Cascade Assistant
- **Progress Auto-Update**: Sync with Jira/GitHub
- **Collaborative Editing**: See teammates' changes in real-time
- **Templates**: Start with pre-built OKR structures
- **Comments**: Discuss nodes directly on canvas

---

## 🐛 Troubleshooting

### Nodes not saving?
- Check your internet connection
- Ensure you're logged in
- Try refreshing the page

### Can't connect nodes?
- Make sure both nodes are saved (have valid data)
- Only connect: Objective → KR or KR → Initiative
- Can't connect same type (e.g., Objective → Objective)

### Layout not persisting?
- Click "Save Layout" button explicitly
- Positions save per-OKR, not canvas-wide

---

## 📞 Need Help?

- Check the legend in top-left corner
- Use the mini-map for navigation
- Zoom in/out with mouse wheel
- Right-click + drag to pan

**Enjoy building your OKRs visually!** 🎨






