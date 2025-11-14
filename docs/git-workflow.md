# Git Workflow Guide

## Repository Status
This project uses git for version control with a structured branching strategy.

## Common Commands

### Check status
```bash
git status
```

### View commit history
```bash
git log --oneline --graph --all
```

### Create a new feature branch
```bash
git checkout -b feature/your-feature-name
```

### Commit changes
```bash
git add .
git commit -m "Brief description of changes"
```

### Switch branches
```bash
git checkout branch-name
```

### Merge a feature branch into main
```bash
git checkout master
git merge feature/your-feature-name
```

## Branching Strategy

- **master**: Main stable branch
- **feature/***: Feature development branches (e.g., `feature/transcription-mechanic`)
- **prototype/***: Experimental prototype branches (e.g., `prototype/v1-basic-ui`)
- **fix/***: Bug fix branches

## Commit Message Guidelines

Use clear, descriptive commit messages:
- `feat: Add transcription puzzle mechanic`
- `fix: Correct RNA polymerase animation timing`
- `docs: Update design notes with splicing mechanics`
- `refactor: Simplify molecule rendering code`
- `prototype: Initial React-based UI exploration`

## Tags for Prototypes

Tag major prototype versions:
```bash
git tag -a v0.1-prototype -m "First playable prototype"
```
