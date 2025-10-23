⚠️ IMPORTANT: Setting up Git LFS (Large File Storage)
This repository contains machine learning model files (.pkl, .json). Due to their large size, these files are managed using Git LFS. To clone and use this repository properly, you must install Git LFS.

Install Git LFS (if not already installed):

macOS: brew install git-lfs
Debian/Ubuntu: sudo apt-get install git-lfs
Other OS Installation Methods
Initialize Git LFS:

git lfs install
Clone the repository:

git clone [repository URL]
Failing to follow the steps above will cause the model files to be downloaded as pointer text files, preventing the application from functioning properly.


How to run:

cd backend

python -m uvicorn main:app --reload



cd frontend

npm start run
