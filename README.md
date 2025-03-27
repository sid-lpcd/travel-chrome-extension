# Activity Search WebML

## Overview

Activity Search WebML is a web-based application that leverages Google's WebAI models integrate into Chrome to provide users with quick activities list summary based on the active tab. The project aims to simplify planning of future trips. Ideas for future implementation: Adding trips into Google Maps List.

## Features

- **Search Functionality**: Search for activities by keywords, categories, or location.
- **WebAI Model**: Small local running AI Model capable of identifying locations and activities.

## Technologies Used

- **Frontend**:HTML, CSS, JavaScript
- **AI Model**: Gemini Mini (Trial)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/activity-search-webML.git
```

2. Navigate to the project directory:

```bash
cd activity-search-webML
```

3. Install dependencies:

```bash
npm install
```

4. Compile project and upload to Chrome:

```bash
npm run build
```

## Usage

1. Open the extension on a page of interest.
2. Input any category of activities (or leave empty to find all)
3. Select relevant activities.
