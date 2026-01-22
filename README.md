# Capstone Project Documentation

## Setting Up 
Make Sure Git is installed. You can do this by using git --version on Windows or git -v on linux

When git is installed, navigate to the repository [here](https://github.com/seansmith72404/Character-Sheet-Tracker)

Copy the link to that repository, and then go to your terminal destination that you want to go to to put this project into. For example, mine is `~/Documents/Capstone/character-sheet-tracker`. If you navigate to `~/Documents/Capstone`, the directory will be created for you

Inside of that terminal, type `git clone` and then copy the link that I put in the step above

Navigate to that directory and then type `npm install`

Now type `npm run dev`. This will give you a localhost link to put into your browser. If you see something, you are good to start working

## Starting Coding

Before making changes (very important), swap to a different branch. You can do this with `git checkout -b <branch name here>`

Note: React will update in real time when the save button is pressed so you will not need to restart the website when making a change

## When you are trying to save code and/or merge it to main branch
When merging to main branch, type the following commands in this order:
1. `git branch` - makes sure you're on your correct branch
2. `git add .` - adds files to the commit that you might have created
3. `git commit -a -m <insert commit message here>` - commits the changes
4. `git push --set-upstream origin/<branch name>`. Note, if you've already pushed this branch before, you can simplify this to `git push`

After doing this, tell us that your branch is created and the name of it so we can test it before we merge it into the main branch. You could alternatively set up a [pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) and then mention that you have a PR ready for one of us to test on and we'll merge it in once it looks good

## When your main branch or one of your other branches are behind
Run `git pull origin main` on the main branch










