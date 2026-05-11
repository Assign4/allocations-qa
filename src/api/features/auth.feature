Feature: Auth API
  
  @debug
  Scenario: Login via API with OTP verification
    Given the allocations API is ready
    When I send a login OTP request for my test email
    Then the OTP should be delivered to my email
    When I verify the OTP via the API
    Then the verification should succeed
