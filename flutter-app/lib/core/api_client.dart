import 'package:dio/dio.dart';

class ApiClient {
  final Dio _dio = Dio();
  
  // Use localhost for development, update for production
  final String baseUrl = 'http://127.0.0.1:8000/api/';

  Future<dynamic> registerUser(Map<String, dynamic>? data) async {
    try {
      Response response = await _dio.post('${baseUrl}register', data: data);
      return response.data;
    } on DioException catch (e) {
      return e.response?.data ?? {'ErrorCode': 1, 'Message': 'Network error'};
    }
  }

  Future<dynamic> login(String email, String password) async {
    try {
      FormData formData = FormData.fromMap({
        'email': email,
        'password': password,
      });
      Response response = await _dio.post('${baseUrl}login', data: formData);
      return response.data;
    } on DioException catch (e) {
      return e.response?.data ?? {'success': false, 'message': 'Network error'};
    }
  }

  Future<dynamic> getUserProfileData(String accessToken) async {
    try {
      Response response = await _dio.get(
        '${baseUrl}user',
        options: Options(
          headers: {'Authorization': 'Bearer $accessToken'},
        ),
      );
      return response.data;
    } on DioException catch (e) {
      return e.response?.data ?? {'ErrorCode': 1, 'Message': 'Network error'};
    }
  }

  Future<dynamic> updateUserProfile({
    required String accessToken,
    required Map<String, dynamic> data,
  }) async {
    try {
      Response response = await _dio.put(
        '${baseUrl}user',
        data: data,
        options: Options(
          headers: {'Authorization': 'Bearer $accessToken'},
        ),
      );
      return response.data;
    } on DioException catch (e) {
      return e.response?.data ?? {'ErrorCode': 1, 'Message': 'Network error'};
    }
  }

  Future<dynamic> logout(String accessToken) async {
    try {
      Response response = await _dio.post('${baseUrl}logout');
      return response.data;
    } on DioException catch (e) {
      return e.response?.data ?? {'ErrorCode': 1, 'Message': 'Network error'};
    }
  }
}

