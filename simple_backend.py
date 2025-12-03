from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
import joblib
import os

class AgriBidHandler(BaseHTTPRequestHandler):
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/train-model':
            self.handle_train_model()
        else:
            self.send_error(404)
    
    def handle_train_model(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data)
            
            # Train model (using your existing training code)
            trainer = CropPricePredictor()
            results = trainer.train_models()
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'status': 'success',
                'accuracy': results,
                'message': 'Model trained successfully'
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            error_response = {
                'status': 'error',
                'message': str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())

class CropPricePredictor:
    def train_models(self):
        # Your training logic here
        # For now, return dummy accuracy
        return {'overall': '90%', 'rice': '92%', 'corn': '88%', 'vegetables': '87%'}

def run_server():
    server_address = ('', 5000)
    httpd = HTTPServer(server_address, AgriBidHandler)
    print('Starting backend server on port 5000...')
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()