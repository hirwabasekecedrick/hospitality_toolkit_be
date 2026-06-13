import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class PaymentGatewaysService {
  private readonly logger = new Logger(PaymentGatewaysService.name);

  // Simulates calling an external payment gateway that operates asynchronously
  async processPayment(transactionId: string, amount: number, reference: string): Promise<string> {
    this.logger.log(`Initiating external payment for transaction ${transactionId} (Ref: ${reference})`);
    
    // Simulate gateway delay and asynchronous webhook callback
    setTimeout(() => {
      this.simulateWebhook(transactionId, "SUCCESS");
    }, 5000); // 5 seconds delay

    return "PENDING_AT_GATEWAY";
  }

  // Simulates the external gateway sending a webhook back to our server
  private async simulateWebhook(transactionId: string, status: "SUCCESS" | "FAILED") {
    try {
      this.logger.log(`Simulating webhook callback for transaction ${transactionId}`);
      // In a real scenario, this would be the external provider calling our public endpoint
      await axios.post(`http://localhost:${process.env.PORT || 4000}/api/webhooks/payment`, {
        transactionId,
        status,
        gatewayReference: `EXT-${Date.now()}`
      }, {
        headers: {
          "X-Webhook-Signature": "mock-signature" // would be real HMAC signature
        }
      });
    } catch (err) {
      this.logger.error("Failed to simulate webhook callback", err);
    }
  }
}
