Feature: Login

  Scenario: User logs in with email OTP
    Given I am on the login page
    When I submit my email for login
    Then I should see the OTP verification page
    When I enter the OTP received in my email
    Then I should be successfully logged in
