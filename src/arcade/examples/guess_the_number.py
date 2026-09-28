# Guess the Number — a text game. Everything happens in the console:
# print() shows text, input() waits for the player to type.
import random

print("I'm thinking of a number from 1 to 100.")
secret = random.randint(1, 100)
tries = 0

while True:
    guess = input("Your guess: ")
    if not guess.isdigit():
        print("Type a whole number, like 42.")
        continue

    guess = int(guess)
    tries = tries + 1

    if guess < secret:
        print("Higher!")
    elif guess > secret:
        print("Lower!")
    else:
        print(f"You got it in {tries} tries!")
        break

again = input("Play again? (y/n) ")
if again.lower().startswith("y"):
    print("Press Run to play again.")
else:
    print("Thanks for playing!")
